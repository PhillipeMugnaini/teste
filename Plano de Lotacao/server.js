//Importando modulos do NODE.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');


const PORT = 3000; //Porta fixa
const publicDir = path.join(__dirname, 'public'); //Caminho da pasta "public" (contém arquivos do front-end)
const db = new DatabaseSync(path.join(__dirname, 'database.sqlite')); //Cria/Abre o arquivo do banco de dados


//Lista de valores válidos
const TURNOS_VALIDOS = ['1º Turno', '2º Turno', '3º Turno'];
const CARGOS_VALIDOS = ['Ajustador', 'Operador', 'Operador 1', 'Operador 2', 'Operador 3', 'Apontador de Produção'];
const STATUS_VALIDOS = ['Ativo', 'Afastado', 'Emprestado', 'Férias', 'Inativo'];
const PROCESSOS_VALIDOS = [
  'LINHA DE EXAMES L1',
  'LINHA DE EXAMES L3',
  'MONTAGEM DO GM',
  'MONTAGEM E EXAMES FLEX',
  'MONTAGEM L1',
  'MONTAGEM L3',
  'SALA INTERLAGOS',
  'USINAGEM AK',
  'USINAGEM DO GM',
  'USINAGEM DO JOGO DE VÁLVULA',
  'USINAGEM FINAL',
  'USINAGEM FLEX',
  'USINAGEM GRUPO INDUZIDO CRIN 1',
  'USINAGEM GRUPO INDUZIDO CRIN 2/3',
  'USINAGEM LMN'
];


//Padronização de respostas JSON da API
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}


//Descobre o tipo de arquivo
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}


function serveStaticFile(res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname; //Preenche o caminho "HTML" para a tela inicial (index.html)
  const filePath = path.normalize(path.join(publicDir, normalized)); //Monta o caminho do arquivo

  if (!filePath.startsWith(publicDir)) { //Etapa de segurança URL
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
    //Aqui estamos evitando que a URL seja manipulada na má intenção, ou seja, evita que a pessoa tenha acesso a arquivos sensiveis.
  }

  fs.readFile(filePath, (err, content) => { //
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  });
}


//Ler corpo das requisições (POST e PUT)
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}


//Criação do Banco de dados caso não exista
function ensureDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      turno TEXT NOT NULL,
      cargo TEXT NOT NULL,
      edv TEXT NOT NULL UNIQUE,
      centro_custo TEXT NOT NULL,
      edv_gestor TEXT,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS planos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_plano TEXT NOT NULL UNIQUE,
      processo TEXT NOT NULL,
      turno TEXT NOT NULL,
      total_operadores INTEGER NOT NULL,
      niveis_json TEXT NOT NULL DEFAULT '[]',
      data_abertura DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultima_edicao DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  //*Verifica se existe a coluna 'niveis_json', se não existir cria
  const colunasPlanos = db.prepare(`PRAGMA table_info(planos)`).all();
  const existeNiveis = colunasPlanos.some((coluna) => coluna.name === 'niveis_json');
  if (!existeNiveis) {
    db.exec(`ALTER TABLE planos ADD COLUMN niveis_json TEXT NOT NULL DEFAULT '[]'`);
  }
}


//Pega qualquer valor e remove tudo, menos números
function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}


//Formata texto (Texto, remove espaço e limita o tamanho máximo de 120 caracateres)
function sanitizeText(valor, max = 120) {
  return String(valor ?? '').trim().slice(0, max);
}


//Verifica se o valor existe dentro de uma lista permitida
function validarValorLista(valor, lista, label) {
  return lista.includes(valor) ? null : `${label} inválido.`;
}


//Converte para ARRAY
function parsePlanosNiveis(valor) {
  if (Array.isArray(valor)) return valor;
  try {
    return JSON.parse(valor || '[]');
  } catch {
    return [];
  }
}


//Padroniza os dados (Não valida, apenas normaliza)
function normalizarOperador(body) {
  return {
    nome: sanitizeText(body.nome, 120),
    turno: sanitizeText(body.turno, 20),
    cargo: sanitizeText(body.cargo, 40),
    edv: somenteDigitos(body.edv).slice(0, 10),
    centro_custo: somenteDigitos(body.centro_custo).slice(0, 6),
    edv_gestor: somenteDigitos(body.edv_gestor).slice(0, 10),
    status: sanitizeText(body.status, 20)
  };
}


//Aplicação de regras para cadastro de operador
function validarOperador(body) {
  const dados = normalizarOperador(body);
  const erros = [];

  if (!dados.nome) erros.push('Nome é obrigatório.');

  const erroTurno = validarValorLista(dados.turno, TURNOS_VALIDOS, 'Turno');
  if (erroTurno) erros.push(erroTurno);

  const erroCargo = validarValorLista(dados.cargo, CARGOS_VALIDOS, 'Cargo');
  if (erroCargo) erros.push(erroCargo);

  if (!dados.edv) erros.push('EDV é obrigatório.');
  if (dados.edv.length > 10) erros.push('EDV deve ter no máximo 10 dígitos.');

  if (dados.centro_custo.length !== 6) erros.push('Centro de Custo deve ter 6 dígitos.');
  if (dados.edv_gestor && dados.edv_gestor.length > 10) erros.push('EDV Gestor deve ter no máximo 10 dígitos.');

  const erroStatus = validarValorLista(dados.status, STATUS_VALIDOS, 'Status');
  if (erroStatus) erros.push(erroStatus);

  return { dados, erros };
}


//!Trocar o 'nível' para 'quantidade total de operadores'
//Aplicação de regras para cadastro de planos
function normalizarPlano(body) {
  const total_operadores = Math.max(parseInt(body.total_operadores, 10) || 0, 0);//Transforma em inteiro e não negativo
  const niveis = Array.isArray(body.niveis) ? body.niveis : [];

  const niveisNormalizados = niveis.map((nivel, index) => ({
    nivel: Number.isInteger(nivel?.nivel) ? nivel.nivel : index,
    nome: sanitizeText(nivel?.nome, 40),
    quantidade: Math.max(parseInt(nivel?.quantidade, 10) || 0, 0),
    operadores: Array.isArray(nivel?.operadores)
      ? nivel.operadores.map((operador) => ({ edv: somenteDigitos(operador?.edv).slice(0, 10) }))
      : []
  }));

  return {
    processo: sanitizeText(body.processo, 120),
    turno: sanitizeText(body.turno, 20),
    total_operadores,
    niveis: niveisNormalizados
  };
}


//!Trocar o 'nível' para 'quantidade total de operadores'
//Validações do Plano
function validarPlano(body) {
  const dados = normalizarPlano(body);
  const erros = [];

  const erroProcesso = validarValorLista(dados.processo, PROCESSOS_VALIDOS, 'Processo');
  if (erroProcesso) erros.push(erroProcesso);

  const erroTurno = validarValorLista(dados.turno, TURNOS_VALIDOS, 'Turno');
  if (erroTurno) erros.push(erroTurno);

  if (!Number.isInteger(dados.total_operadores) || dados.total_operadores <= 0) {
    erros.push('Quantidade de Operadores deve ser maior que zero.');
  }

  const soma = dados.niveis.reduce((acc, nivel) => acc + nivel.quantidade, 0);
  if (soma !== dados.total_operadores) {
    erros.push(`A soma dos níveis deve ser igual a ${dados.total_operadores}.`);
  }

  const todosEdvs = [];
  dados.niveis.forEach((nivel) => {
    if (nivel.quantidade !== nivel.operadores.length) {
      erros.push(`O nível ${nivel.nome || nivel.nivel} está inconsistente.`);
    }

    //Verifica os EDV's de cada operador
    nivel.operadores.forEach((operador, index) => {
      if (!operador.edv) {
        erros.push(`Preencha o EDV do ${index + 1}° ${nivel.nome || 'Operador'}.`);
      } else if (operador.edv.length > 10) {
        erros.push(`O EDV do ${index + 1}° ${nivel.nome || 'Operador'} deve ter no máximo 10 dígitos.`);
      }
      todosEdvs.push(operador.edv);
    });
  });

  //Impede de ter EDV duplicado no mesmo plano
  const duplicados = todosEdvs.filter((edv, index) => edv && todosEdvs.indexOf(edv) !== index);
  if (duplicados.length) erros.push('Existem EDVs repetidos no plano.');

  return { dados, erros: [...new Set(erros)] };
}


//Gera o próximo código do plano com base no último criado no banco de dados
function gerarProximoCodigoPlano() {
  const row = db.prepare(`SELECT codigo_plano FROM planos ORDER BY id DESC LIMIT 1`).get();
  const ultimoNumero = row?.codigo_plano ? parseInt(String(row.codigo_plano).replace(/\D/g, ''), 10) || 0 : 0;
  const proximoNumero = ultimoNumero + 1;
  return `PL${String(proximoNumero).padStart(3, '0')}`;
}

ensureDatabase();

//Eis que nasce um bebê (Servidor)
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    //Realiza a busca com filtro universal (Nome, EDV, Centro de custo e cargo)
    if (req.method === 'GET' && pathname === '/api/operadores') {
      const busca = sanitizeText(url.searchParams.get('busca'), 120);
      const termo = `%${busca}%`;
      const rows = db.prepare(`
        SELECT * FROM operadores
        WHERE nome LIKE ? OR edv LIKE ? OR centro_custo LIKE ? OR cargo LIKE ?
        ORDER BY nome ASC
      `).all(termo, termo, termo, termo);
      return sendJson(res, 200, rows);
    }

    //! Usamos mesmo?
    //Busca um operador pelo EDV
    if (req.method === 'GET' && pathname.startsWith('/api/operadores/edv/')) {
      const edv = somenteDigitos(decodeURIComponent(pathname.replace('/api/operadores/edv/', ''))).slice(0, 10);
      const row = db.prepare('SELECT * FROM operadores WHERE edv = ?').get(edv);
      if (!row) return sendJson(res, 404, { erro: 'Operador não encontrado.' });
      return sendJson(res, 200, row);
    }

    //! Usamos mesmo?
    //Busca pelo ID
    if (req.method === 'GET' && /^\/api\/operadores\/\d+$/.test(pathname)) {
      const id = Number(pathname.replace('/api/operadores/', ''));
      const row = db.prepare('SELECT * FROM operadores WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { erro: 'Operador não encontrado.' });
      return sendJson(res, 200, row);
    }

    //Cadastra o operador
    if (req.method === 'POST' && pathname === '/api/operadores') {
      const body = await readRequestBody(req);
      const { dados, erros } = validarOperador(body);
      if (erros.length) return sendJson(res, 400, { erro: erros[0] });

      try {
        const result = db.prepare(`
          INSERT INTO operadores (nome, turno, cargo, edv, centro_custo, edv_gestor, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(dados.nome, dados.turno, dados.cargo, dados.edv, dados.centro_custo, dados.edv_gestor || null, dados.status);

        return sendJson(res, 201, { mensagem: 'Operador cadastrado com sucesso.', id: Number(result.lastInsertRowid) });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
          return sendJson(res, 409, { erro: 'Já existe um operador com esse EDV.' });
        }
        throw error;
      }
    }

    //Atualiza operador existente
    if (req.method === 'PUT' && /^\/api\/operadores\/\d+$/.test(pathname)) {
      const id = Number(pathname.replace('/api/operadores/', ''));
      const body = await readRequestBody(req);
      const { dados, erros } = validarOperador(body);
      if (erros.length) return sendJson(res, 400, { erro: erros[0] });

      try {
        const result = db.prepare(`
          UPDATE operadores
          SET nome = ?, turno = ?, cargo = ?, edv = ?, centro_custo = ?, edv_gestor = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(dados.nome, dados.turno, dados.cargo, dados.edv, dados.centro_custo, dados.edv_gestor, dados.status, id);

        if (result.changes === 0) return sendJson(res, 404, { erro: 'Operador não encontrado.' });
        return sendJson(res, 200, { mensagem: 'Operador atualizado com sucesso.' });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
          return sendJson(res, 409, { erro: 'Já existe um operador com esse EDV.' });
        }
        throw error;
      }
    }

    //Exclui o operador
    if (req.method === 'DELETE' && /^\/api\/operadores\/\d+$/.test(pathname)) {
      const id = Number(pathname.replace('/api/operadores/', ''));
      const result = db.prepare('DELETE FROM operadores WHERE id = ?').run(id);
      if (result.changes === 0) return sendJson(res, 404, { erro: 'Operador não encontrado.' });
      return sendJson(res, 200, { mensagem: 'Operador excluído com sucesso.' });
    }

    //Retorna o próximo plano disponível
    if (req.method === 'GET' && pathname === '/api/planos/proximo-codigo') {
      return sendJson(res, 200, { codigo_plano: gerarProximoCodigoPlano() });
    }

    //Lista os planos com base na busca
    if (req.method === 'GET' && pathname === '/api/planos') {
      const busca = sanitizeText(url.searchParams.get('busca'), 50).toUpperCase();
      const termo = `%${busca}%`;
      const rows = db.prepare(`
        SELECT id, codigo_plano, processo, turno, total_operadores, data_abertura, ultima_edicao
        FROM planos
        WHERE UPPER(codigo_plano) LIKE ? OR UPPER(processo) LIKE ? OR UPPER(turno) LIKE ?
        ORDER BY id DESC
      `).all(termo, termo, termo);
      return sendJson(res, 200, rows);
    }

    //!Usamos mesmo?
    //Busca um plano pelo ID
    if (req.method === 'GET' && /^\/api\/planos\/\d+$/.test(pathname)) {
      const id = Number(pathname.replace('/api/planos/', ''));
      const row = db.prepare(`SELECT * FROM planos WHERE id = ?`).get(id);
      if (!row) return sendJson(res, 404, { erro: 'Plano não encontrado.' });
      row.niveis = parsePlanosNiveis(row.niveis_json);
      delete row.niveis_json;
      return sendJson(res, 200, row);
    }

    //Cadastra um novo plano
    if (req.method === 'POST' && pathname === '/api/planos') {
      const body = await readRequestBody(req);
      const { dados, erros } = validarPlano(body);
      if (erros.length) return sendJson(res, 400, { erro: erros[0] });

      const codigoPlano = gerarProximoCodigoPlano();

      const agora = new Date().toLocaleString('sv-SE', {
        timeZone: 'America/Sao_Paulo'
      });

      const result = db.prepare(`
    INSERT INTO planos (codigo_plano, processo, turno, total_operadores, niveis_json, data_abertura)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
        codigoPlano,
        dados.processo,
        dados.turno,
        dados.total_operadores,
        JSON.stringify(dados.niveis),
        agora
      );

      return sendJson(res, 201, {
        mensagem: 'Plano cadastrado com sucesso.',
        id: Number(result.lastInsertRowid),
        codigo_plano: codigoPlano
      });
    }

    //Atualiza o plano existente
    if (req.method === 'PUT' && /^\/api\/planos\/\d+$/.test(pathname)) {
      const id = Number(pathname.replace('/api/planos/', ''));
      const body = await readRequestBody(req);
      const { dados, erros } = validarPlano(body);
      if (erros.length) return sendJson(res, 400, { erro: erros[0] });
      const agora = new Date().toLocaleString('sv-SE', {
        timeZone: 'America/Sao_Paulo'
      });


      const result = db.prepare(`
        UPDATE planos
        SET processo = ?, turno = ?, total_operadores = ?, niveis_json = ?, ultima_edicao = ?
        WHERE id = ?
      `).run(dados.processo, dados.turno, dados.total_operadores, JSON.stringify(dados.niveis), agora, id);

      if (result.changes === 0) return sendJson(res, 404, { erro: 'Plano não encontrado.' });
      return sendJson(res, 200, { mensagem: 'Plano atualizado com sucesso.' });
    }

    //Rota insere operadores de teste
    if (req.method === 'POST' && pathname === '/api/seed-operadores') {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO operadores (nome, turno, cargo, edv, centro_custo, edv_gestor, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run('João Silva', '1º Turno', 'Operador', '100001', '123456', '900001', 'Ativo');
      stmt.run('Maria Oliveira', '2º Turno', 'Operador 1', '100002', '123457', '900001', 'Ativo');
      stmt.run('Carlos Souza', '3º Turno', 'Ajustador', '100003', '123458', '900002', 'Ativo');
      return sendJson(res, 200, { mensagem: 'Operadores de teste inseridos.' });
    }

    return serveStaticFile(res, pathname);
  } catch (error) {
    console.error('ERRO OPERADOR:', erro);
    return sendJson(res, 500, { erro: 'Erro interno do servidor.', detalhe: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
