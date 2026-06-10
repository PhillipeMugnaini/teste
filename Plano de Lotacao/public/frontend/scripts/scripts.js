const API_BASE = '/api';

// Listas de Validação
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

// Troca de página
function irPara(url) {
  window.location.href = url;
}

// Lê parâmetros da URL
function getParametroUrl(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

// Sistema unificado de Alertbox dinâmico com auto-close BLINDADO CONTRA ERROS
function mostrarMensagem(texto, tipo = 'sucesso', containerId = 'alert-container') {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    container.style.cssText = "width: 100%; display: flex; flex-direction: column; align-items: center; position: fixed; top: 20px; z-index: 9999; pointer-events: none;";
    document.body.prepend(container);
  }

  container.style.pointerEvents = "auto";

  let classeTipo = 'message-box-success';
  let icone = 'fa-check';
  let label = 'Sucesso';

  if (tipo === 'erro') {
    classeTipo = 'message-box-error';
    icone = 'fa-ban';
    label = 'Erro';
  } else if (tipo === 'aviso' || tipo === 'warn') {
    classeTipo = 'message-box-warn';
    icone = 'fa-warning';
    label = 'Aviso';
  } else if (tipo === 'info') {
    classeTipo = 'message-box-info';
    icone = 'fa-info-circle';
    label = 'Info';
  }

  const viewBox = document.createElement('div');
  viewBox.className = `message-box ${classeTipo}`;
  
  // Estilos base iniciais forçados
  viewBox.style.cssText = "opacity: 1 !important; display: flex !important; transition: all 0.3s ease !important;";

  viewBox.innerHTML = `
    <i class="fa ${icone} fa-2x"></i>
    <span class="message-text"><strong>${label}:</strong> ${texto}</span>
    <i class="fa fa-times fa-2x exit-button" style="cursor: pointer;"></i>
  `;

  // Remoção absoluta à prova de falhas
  const executarRemocaoAbsoluta = () => {
    if (!viewBox) return;
    
    // 1. Tenta esmaecer suavemente
    viewBox.style.setProperty('opacity', '0', 'important');
    viewBox.style.setProperty('transform', 'scale(0.9)', 'important');
    
    // 2. Força o sumiço completo e deleta do HTML (Garantido)
    setTimeout(() => {
      viewBox.style.setProperty('display', 'none', 'important');
      if (viewBox.parentNode) {
        viewBox.parentNode.removeChild(viewBox);
      }
    }, 300);
  };

  // Clique manual no X
  viewBox.querySelector('.exit-button').addEventListener('click', (e) => {
    e.stopPropagation();
    executarRemocaoAbsoluta();
  });

  container.appendChild(viewBox);

  // Auto-close cravado em 3 segundos (3000ms)
  setTimeout(executarRemocaoAbsoluta, 3000);
}

// Limpa mensagens de forma segura sem quebrar referências
function limparMensagem(containerId = 'alert-container') {
  const container = document.getElementById(containerId);
  if (container) {
    // Remove os alertas aplicando o efeito fade individualmente
    const alertas = container.querySelectorAll('.message-box');
    alertas.forEach(alerta => {
      alerta.style.opacity = '0';
      setTimeout(() => alerta.remove(), 400);
    });
  }
}

// Faz requisições a API
async function requestJson(url, options = {}) {
  const resposta = await fetch(url, options);
  let dados = null;

  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    throw new Error(dados?.erro || `Erro HTTP ${resposta.status}`);
  }

  return dados;
}

// Remove tudo que não for número
function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

// Limita a quantidade de digitos
function limitarDigitos(valor, maximo) {
  return somenteDigitos(valor).slice(0, maximo);
}

// Configura inputs numéricos
function configurarCamposNumericos() {
  document.querySelectorAll('.apenas-numeros').forEach((input) => {
    const maxDigits = Number(input.dataset.maxDigits || 0);

    input.addEventListener('input', () => {
      const tratado = maxDigits > 0 ? limitarDigitos(input.value, maxDigits) : somenteDigitos(input.value);
      if (input.value !== tratado) input.value = tratado;
      input.classList.remove('campo-invalido');
    });
  });
}

// Adiciona/remove a classe 'campo-invalido'
function marcarCampoInvalido(elemento, invalido = true) {
  if (!elemento) return;
  elemento.classList.toggle('campo-invalido', invalido);
}

function validarObrigatorio(input, mensagem) {
  const valido = !!input?.value?.trim();
  marcarCampoInvalido(input, !valido);
  return valido ? null : mensagem;
}

function validarDigitos(input, { exato = null, max = null, obrigatorio = false, label = 'Campo' } = {}) {
  const valor = somenteDigitos(input?.value || '');
  if (input) input.value = valor;

  if (!valor) {
    const erro = obrigatorio ? `${label} é obrigatório.` : null;
    marcarCampoInvalido(input, !!erro);
    return erro;
  }

  if (exato !== null && valor.length !== exato) {
    marcarCampoInvalido(input, true);
    return `${label} deve ter ${exato} dígitos.`;
  }

  if (max !== null && valor.length > max) {
    marcarCampoInvalido(input, true);
    return `${label} deve ter no máximo ${max} dígitos.`;
  }

  marcarCampoInvalido(input, false);
  return null;
}

function validarValorPermitido(input, valoresPermitidos, label) {
  const valor = input?.value || '';
  const valido = valoresPermitidos.includes(valor);
  marcarCampoInvalido(input, !valido);
  return valido ? null : `${label} inválido.`;
}

function configurarNavegacao() {
  document.querySelector('.btn-proxima-tela')?.addEventListener('click', validarLogin);
  document.getElementById('btn-voltar')?.addEventListener('click', () => irPara('index.html'));
  document.getElementById('btn-edt-plano')?.addEventListener('click', () => irPara('buscaEDT.html'));
  document.getElementById('btn-novo-plano')?.addEventListener('click', () => irPara('cadastro.html'));
  document.getElementById('btn-operadores')?.addEventListener('click', () => irPara('menu_operadores.html'));
  document.getElementById('btn-add-operador')?.addEventListener('click', () => irPara('cadastro-operador.html'));
  document.getElementById('btn-listar-operadores')?.addEventListener('click', () => irPara('operadores.html'));
  document.getElementById('btn-voltar-menu')?.addEventListener('click', () => irPara('menu.html'));
  document.getElementById('btn-voltar-operadores')?.addEventListener('click', () => irPara('menu_operadores.html'));
  document.getElementById('btn-novo-operador')?.addEventListener('click', () => irPara('cadastro-operador.html'));

  // Escuta ativa para monitorar a digitação do EDV no Login
  configurarMudancaCorBotaoLogin();
}

function configurarMudancaCorBotaoLogin() {
  const inputLogin = document.getElementById('edv-login');
  const btnProxima = document.querySelector('.btn-proxima-tela');
  
  if (!inputLogin || !btnProxima) return;

  inputLogin.addEventListener('input', () => {
    const valor = inputLogin.value.trim();
    
    // Regra Bosch: Ativa o realce azul a partir de 4 dígitos inseridos
    if (valor.length >= 4) {
      btnProxima.classList.add('active');
    } else {
      btnProxima.classList.remove('active');
    }
  });
}

function validarLogin() {
  const input = document.getElementById('edv-login');
  const btnProxima = document.querySelector('.btn-proxima-tela');
  if (!input) return;

  limparMensagem('alert-container');
  const erro = validarDigitos(input, { max: 10, obrigatorio: true, label: 'EDV' });

  if (erro) {
    mostrarMensagem(erro, 'erro', 'alert-container');
    btnProxima?.classList.remove('active'); 
    return;
  }

  sessionStorage.setItem('usuarioEDV', input.value.trim());
  setTimeout(() => irPara('menu2.html'), 400);
}

function getDadosFormularioOperador() {
  return {
    nome: document.getElementById('nome')?.value?.trim() || '',
    turno: document.getElementById('turno')?.value || '',
    cargo: document.getElementById('cargo')?.value || '',
    edv: somenteDigitos(document.getElementById('edv')?.value || ''),
    centro_custo: somenteDigitos(document.getElementById('centro_custo')?.value || ''),
    edv_gestor: somenteDigitos(document.getElementById('edv_gestor')?.value || ''),
    status: document.getElementById('status')?.value || ''
  };
}

function preencherFormularioOperador(operador) {
  document.getElementById('operador-id').value = operador.id ?? '';
  document.getElementById('nome').value = operador.nome ?? '';
  document.getElementById('turno').value = operador.turno ?? '';
  document.getElementById('cargo').value = operador.cargo ?? '';
  document.getElementById('edv').value = operador.edv ?? '';
  document.getElementById('centro_custo').value = operador.centro_custo ?? '';
  document.getElementById('edv_gestor').value = operador.edv_gestor ?? '';
  document.getElementById('status').value = operador.status ?? '';
}

function validarFormularioOperador() {
  const erros = [];
  const nome = document.getElementById('nome');
  const turno = document.getElementById('turno');
  const cargo = document.getElementById('cargo');
  const edv = document.getElementById('edv');
  const centroCusto = document.getElementById('centro_custo');
  const edvGestor = document.getElementById('edv_gestor');
  const status = document.getElementById('status');

  const erroNome = validarObrigatorio(nome, 'Nome é obrigatório.');
  if (erroNome) erros.push(erroNome);

  const erroTurno = validarValorPermitido(turno, TURNOS_VALIDOS, 'Turno');
  if (erroTurno) erros.push(erroTurno);

  const erroCargo = validarValorPermitido(cargo, CARGOS_VALIDOS, 'Cargo');
  if (erroCargo) erros.push(erroCargo);

  const erroEdv = validarDigitos(edv, { max: 10, obrigatorio: true, label: 'EDV' });
  if (erroEdv) erros.push(erroEdv);

  const erroCc = validarDigitos(centroCusto, { exato: 6, obrigatorio: true, label: 'Centro de Custo' });
  if (erroCc) erros.push(erroCc);

  const erroEdvGestor = validarDigitos(edvGestor, { max: 10, obrigatorio: false, label: 'EDV Gestor' });
  if (erroEdvGestor) erros.push(erroEdvGestor);

  const erroStatus = validarValorPermitido(status, STATUS_VALIDOS, 'Status');
  if (erroStatus) erros.push(erroStatus);

  return erros;
}

async function salvarOperador(event) {
  event.preventDefault();
  limparMensagem();

  const erros = validarFormularioOperador();
  if (erros.length) {
    mostrarMensagem(erros[0], 'erro');
    return;
  }

  const id = document.getElementById('operador-id')?.value?.trim() || '';
  const dados = getDadosFormularioOperador();

  try {
    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/operadores/${id}` : `${API_BASE}/operadores`;

    const resultado = await requestJson(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    mostrarMensagem(resultado.mensagem || 'Operador salvo com sucesso.', 'sucesso');
    setTimeout(() => irPara('operadores.html'), 3500);
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao salvar operador.', 'erro');
  }
}

async function carregarOperadorParaEdicao() {
  const id = getParametroUrl('id');
  if (!id) return;

  try {
    const operador = await requestJson(`${API_BASE}/operadores/${id}`);
    preencherFormularioOperador(operador);
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao carregar operador.', 'erro');
  }
}

function configurarFormularioOperador() {
  const form = document.getElementById('form-operador');
  if (!form) return;

  form.addEventListener('submit', salvarOperador);
  carregarOperadorParaEdicao();
}

function criarBotaoAcao(texto, classe, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn-acao ${classe}`;
  btn.textContent = texto;
  btn.addEventListener('click', onClick);
  return btn;
}

async function excluirOperador(id) {
  if (!confirm('Deseja realmente excluir este operador?')) return;

  try {
    const resultado = await requestJson(`${API_BASE}/operadores/${id}`, { method: 'DELETE' });
    mostrarMensagem(resultado.mensagem || 'Operador excluído com sucesso.', 'sucesso');
    carregarOperadores();
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao excluir operador.', 'erro');
  }
}

async function carregarOperadores() {
  const tbody = document.getElementById('operadores-tbody');
  if (!tbody) return;

  const busca = document.getElementById('busca-operador')?.value?.trim() || '';

  try {
    const operadores = await requestJson(`${API_BASE}/operadores?busca=${encodeURIComponent(busca)}`);
    tbody.innerHTML = '';

    if (!operadores.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum operador encontrado.</td></tr>';
      return;
    }

    operadores.forEach((operador) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${operador.nome}</td>
        <td>${operador.turno}</td>
        <td>${operador.cargo}</td>
        <td>${operador.edv}</td>
        <td>${operador.centro_custo}</td>
        <td>${operador.status}</td>
        <td></td>
      `;

      const tdAcoes = tr.lastElementChild;
      const divAcoes = document.createElement('div');
      divAcoes.className = 'acoes-linha';
      divAcoes.appendChild(criarBotaoAcao('Editar', 'btn-editar', () => irPara(`cadastro-operador.html?id=${operador.id}`)));
      divAcoes.appendChild(criarBotaoAcao('Excluir', 'btn-excluir', () => excluirOperador(operador.id)));
      tdAcoes.appendChild(divAcoes);
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar operadores: ${error.message}</td></tr>`;
  }
}

function configurarListagemOperadores() {
  const tbody = document.getElementById('operadores-tbody');
  if (!tbody) return;
  document.getElementById('busca-operador')?.addEventListener('input', carregarOperadores);
  carregarOperadores();
}

async function buscarDadosOperador(edv) {
  if (!edv) return { nome: '---', cc: '---' };

  try {
    const operador = await requestJson(`${API_BASE}/operadores/edv/${encodeURIComponent(edv)}`);
    return {
      nome: operador?.nome || operador?.data?.nome || operador?.operador?.nome || '---',
      cc: operador?.centro_custo || operador?.data?.centro_custo || operador?.operador?.centro_custo || '---',
      cargo: operador?.cargo || operador?.data?.cargo || ''
    };
  } catch {
    return { nome: 'Não encontrado', cc: '---' };
  }
}

function nomeNivelPorIndice(nivel) {
  switch (nivel) {
    case 0: return 'Operador';
    case 1: return 'Operador I';
    case 2: return 'Operador II';
    case 3: return 'Operador III';
    case 4: return 'Ajustador';
    default: return `Nível ${nivel}`;
  }
}

function atualizarIndicadoresPlano(total) {
  const totalEl = document.getElementById('indicador-total-operadores');
  const crinEl = document.getElementById('indicador-operadores-crin');
  const apoioEl = document.getElementById('indicador-apoio');
  const indisponivelEl = document.getElementById('indicador-indisponivel');
  const semAlocacaoEl = document.getElementById('indicador-sem-alocacao');

  if (totalEl) totalEl.textContent = String(total || 0);
  if (crinEl) crinEl.textContent = String(total || 0);
  if (apoioEl) apoioEl.textContent = '0';
  if (indisponivelEl) indisponivelEl.textContent = '0';
  if (semAlocacaoEl) semAlocacaoEl.textContent = '0';
}

function somarQuantidadesNiveis() {
  return [...document.querySelectorAll('.qtd-nivel-input')].reduce((soma, input) => {
    return soma + (parseInt(input.value, 10) || 0);
  }, 0);
}

async function validarEGerarCamposIDs(inputFocado, limiteGlobal, valoresExistentes = []) {
  const nivel = parseInt(inputFocado.dataset.nivel, 10);
  const containerIDs = document.getElementById(`campos-nivel-${nivel}`);
  if (!containerIDs) return;

  const somaAtual = somarQuantidadesNiveis();
  if (somaAtual > limiteGlobal) {
    mostrarMensagem(`A soma total (${somaAtual}) não pode ultrapassar o limite de ${limiteGlobal}.`, 'erro');
    inputFocado.value = '';
    containerIDs.innerHTML = '';
    return;
  }

  const qtdNoNivel = parseInt(inputFocado.value, 10) || 0;
  const nomeNivel = nomeNivelPorIndice(nivel);
  containerIDs.innerHTML = '';

  for (let i = 1; i <= qtdNoNivel; i++) {
    const valorExistente = valoresExistentes[i - 1] || {};
    const divLinha = document.createElement('div');
    divLinha.className = 'edv-row';
    divLinha.innerHTML = `
      <label style="display:block; font-size:0.9rem; margin-bottom:5px;">${i}° ${nomeNivel} - EDV</label>
      <div class="edv-row-grid">
        <input
          type="number"
          class="form-input edv-input apenas-numeros"
          min="0"
          inputmode="numeric"
          data-max-digits="10"
          placeholder="Digite o EDV"
          value="${valorExistente.edv || ''}"
        >
        <input type="text" class="readonly-output nome-operador-output" value="Nome: ---" readonly>
        <input type="text" class="readonly-output centro-custo-output" value="CC: ---" readonly>
      </div>
    `;

    const inputEDV = divLinha.querySelector('.edv-input');
    const outputNome = divLinha.querySelector('.nome-operador-output');
    const outputCC = divLinha.querySelector('.centro-custo-output');

    inputEDV.addEventListener('input', async (e) => {
      const edv = limitarDigitos(e.target.value, 10);
      e.target.value = edv;
      if (edv.length >= 4) {
        const dados = await buscarDadosOperador(edv);

        outputNome.value = `Nome: ${dados.nome}`;
        outputCC.value = `CC: ${dados.cc}`;

        if (dados.cargo && dados.cargo.trim() !== nomeNivel.trim()) {
          mostrarAlertaNivel(
            nivel,
            `DESVIO: EDV ${edv} é "${dados.cargo}" e está como "${nomeNivel}"`
          );
        }
      } else {
        outputNome.value = 'Nome: ---';
        outputCC.value = 'CC: ---';
      }
    });

    if (valorExistente.edv) {
      inputEDV.dispatchEvent(new Event('input'));
    }

    containerIDs.appendChild(divLinha);
  }

  configurarCamposNumericos();
}

function coletarNiveisPlano() {
  const niveis = [];
  document.querySelectorAll('.qtd-nivel-input').forEach((input) => {
    const nivel = parseInt(input.dataset.nivel, 10);
    const quantidade = parseInt(input.value, 10) || 0;
    const edvs = [...document.querySelectorAll(`#campos-nivel-${nivel} .edv-input`)].map((campo) => ({
      edv: somenteDigitos(campo.value)
    }));

    niveis.push({
      nivel,
      nome: nomeNivelPorIndice(nivel),
      quantidade,
      operadores: edvs
    });
  });
  return niveis;
}

function getDadosFormularioPlano() {
  return {
    processo: document.getElementById('processo')?.value || '',
    turno: document.getElementById('turno-plano')?.value || '',
    total_operadores: parseInt(document.getElementById('input-total-operadores')?.value, 10) || 0,
    niveis: coletarNiveisPlano()
  };
}

function validarFormularioPlano() {
  const erros = [];
  const processo = document.getElementById('processo');
  const turno = document.getElementById('turno-plano');
  const total = document.getElementById('input-total-operadores');

  const erroProcesso = validarValorPermitido(processo, PROCESSOS_VALIDOS, 'Processo');
  if (erroProcesso) erros.push(erroProcesso);

  const erroTurno = validarValorPermitido(turno, TURNOS_VALIDOS, 'Turno');
  if (erroTurno) erros.push(erroTurno);

  const erroTotal = validarDigitos(total, { max: 3, obrigatorio: true, label: 'Quantidade de Operadores' });
  if (erroTotal) erros.push(erroTotal);

  const totalOperadores = parseInt(total.value, 10) || 0;
  if (totalOperadores <= 0) {
    marcarCampoInvalido(total, true);
    erros.push('Quantidade de Operadores deve ser maior que zero.');
  }

  const niveis = coletarNiveisPlano();
  const soma = niveis.reduce((acc, item) => acc + item.quantidade, 0);
  if (soma !== totalOperadores) {
    erros.push(`A soma dos níveis deve ser igual a ${totalOperadores}.`);
  }

  const edvs = [];
  niveis.forEach((nivelInfo) => {
    if (nivelInfo.quantidade !== nivelInfo.operadores.length) {
      erros.push(`O nível ${nivelInfo.nome} está inconsistente.`);
      return;
    }

    nivelInfo.operadores.forEach((operador, index) => {
      if (!operador.edv) {
        erros.push(`Preencha o EDV do ${index + 1}° ${nivelInfo.nome}.`);
        return;
      }

      if (operador.edv.length > 10) {
        erros.push(`O EDV do ${index + 1}° ${nivelInfo.nome} deve ter no máximo 10 dígitos.`);
      }

      edvs.push(operador.edv);
    });
  });

  const duplicados = edvs.filter((edv, index) => edvs.indexOf(edv) !== index);
  if (duplicados.length) {
    erros.push('Existem EDVs repetidos no plano.');
  }

  return [...new Set(erros)];
}

function renderizarNiveisPlano(totalPermitido, niveisExistentes = []) {
  const containerNiveis = document.getElementById('container-niveis');
  if (!containerNiveis) return;

  if (totalPermitido <= 0) {
    containerNiveis.innerHTML = '';
    atualizarIndicadoresPlano(0);
    return;
  }

  let html = '';
  for (let nivel = 0; nivel <= 4; nivel++) {
    const nomeNivel = nomeNivelPorIndice(nivel);
    const existente = niveisExistentes.find((item) => item.nivel === nivel) || {};

    html += `
      <div class="nivel-card">
        <h3 class="nivel-titulo">${nomeNivel}</h3>
        <p>Quantidade de pessoas com cargo "${nomeNivel}"</p>
        <input type="number" min="0" class="form-input qtd-nivel-input apenas-numeros" data-max-digits="3" data-nivel="${nivel}" value="${existente.quantidade || ''}">
        <div id="campos-nivel-${nivel}" class="campos-ids-container"></div>
        <p class="mensagem-desvio" id="mensagem-nivel-${nivel}"></p>
      </div>
    `;
  }

  containerNiveis.innerHTML = html;
  configurarCamposNumericos();

  document.querySelectorAll('.qtd-nivel-input').forEach((input) => {
    const nivel = parseInt(input.dataset.nivel, 10);
    const existente = niveisExistentes.find((item) => item.nivel === nivel);

    input.addEventListener('input', (e) => {
      const valor = parseInt(e.target.value, 10) || 0;
      if (valor < 0) e.target.value = '0';
      validarEGerarCamposIDs(e.target, totalPermitido);
    });

    validarEGerarCamposIDs(input, totalPermitido, existente?.operadores || []);
  });

  atualizarIndicadoresPlano(totalPermitido);
}

function mostrarAlertaNivel(nivel, mensagem) {
  const el = document.getElementById(`mensagem-nivel-${nivel}`);
  if (!el) return;

  const jaExiste = [...el.children].some(
    (child) => child.textContent === mensagem
  );

  if (jaExiste) return;

  const novaMsg = document.createElement('div');
  novaMsg.textContent = mensagem; // Corrigido de 'mensaje' para 'mensagem'
  novaMsg.style.color = 'Red';
  novaMsg.style.marginBottom = '4px';
  novaMsg.style.fontSize = '0.9rem';

  el.appendChild(novaMsg);
}

function preencherFormularioPlano(plano) {
  document.getElementById('plano-id').value = plano.id ?? '';
  document.getElementById('codigo-plano').value = plano.codigo_plano ?? '';
  document.getElementById('codigo-plano-titulo').textContent = plano.codigo_plano ?? 'Novo Plano';
  document.getElementById('processo').value = plano.processo ?? '';
  document.getElementById('turno-plano').value = plano.turno ?? '';
  document.getElementById('input-total-operadores').value = plano.total_operadores ?? '';
  renderizarNiveisPlano(Number(plano.total_operadores || 0), Array.isArray(plano.niveis) ? plano.niveis : []);
}

async function carregarPlanoParaEdicao() {
  const id = getParametroUrl('id');
  if (!id) return;

  try {
    const plano = await requestJson(`${API_BASE}/planos/${id}`);
    preencherFormularioPlano(plano);
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao carregar plano.', 'erro');
  }
}

async function carregarProximoCodigoPlano() {
  const codigoInput = document.getElementById('codigo-plano');
  const titulo = document.getElementById('codigo-plano-titulo');
  const id = getParametroUrl('id');
  if (!codigoInput || id) return;

  try {
    const dados = await requestJson(`${API_BASE}/planos/proximo-codigo`);
    codigoInput.value = dados.codigo_plano;
    if (titulo) titulo.textContent = dados.codigo_plano;
  } catch {
    codigoInput.value = 'PL001';
    if (titulo) titulo.textContent = 'PL001';
  }
}

async function salvarPlano(event) {
  event.preventDefault();
  limparMensagem();

  const erros = validarFormularioPlano();
  if (erros.length) {
    mostrarMensagem(erros[0], 'erro');
    return;
  }

  const id = document.getElementById('plano-id')?.value?.trim() || '';
  const dados = getDadosFormularioPlano();

  try {
    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/planos/${id}` : `${API_BASE}/planos`;
    const resultado = await requestJson(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    mostrarMensagem(resultado.mensagem || 'Plano salvo com sucesso.', 'sucesso');
    setTimeout(() => irPara('buscaEDT.html'), 3500);
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao salvar plano.', 'erro');
  }
}

function configurarCadastroPlano() {
  const form = document.getElementById('form-plano');
  const inputTotal = document.getElementById('input-total-operadores');
  if (!form || !inputTotal) return;

  carregarProximoCodigoPlano();
  carregarPlanoParaEdicao();

  inputTotal.addEventListener('input', () => {
    const totalPermitido = parseInt(inputTotal.value, 10) || 0;
    renderizarNiveisPlano(totalPermitido);
  });

  form.addEventListener('submit', salvarPlano);
}

function formatarData(dataIso) {
  if (!dataIso) return '---';
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;
  return data.toLocaleString('pt-BR');
}

function criarResumoPlano(plano) {
  return `
    <strong>${plano.codigo_plano}</strong> - ${plano.processo} - ${plano.turno}
    <div class="plan-item-linha-secundaria">
      Abertura: ${formatarData(plano.data_abertura)} - Última edição: ${formatarData(plano.ultima_edicao)} - Total: ${plano.total_operadores}
    </div>
  `;
}

async function filtrarPlanos() {
  const input = document.getElementById('search-input');
  const container = document.getElementById('lista-planos-content');
  if (!input || !container) return;

  try {
    const termo = input.value.trim();
    const planos = await requestJson(`${API_BASE}/planos?busca=${encodeURIComponent(termo)}`);
    container.innerHTML = '';

    if (!planos.length) {
      container.innerHTML = '<div class="plan-item">Nenhum plano encontrado.</div>';
      return;
    }

    planos.forEach((plano) => {
      const item = document.createElement('div');
      item.className = 'plan-item';
      item.innerHTML = criarResumoPlano(plano);
      item.addEventListener('click', () => irPara(`cadastro.html?id=${plano.id}`));
      container.appendChild(item);
    });
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao buscar planos.', 'erro');
  }
}

function configurarBuscaPlanos() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', filtrarPlanos);
  filtrarPlanos();
}

function preencherInfoUsuario() {
  const userInfo = document.getElementById('plano-user-info');
  if (!userInfo) return;
  const edv = sessionStorage.getItem('usuarioEDV');
  userInfo.textContent = edv ? `EDV ${edv}` : '';
}

// Inicializador único de escopo do DOM
document.addEventListener('DOMContentLoaded', () => {
  configurarCamposNumericos();
  configurarNavegacao();
  configurarFormularioOperador();
  configurarListagemOperadores();
  configurarCadastroPlano();
  configurarBuscaPlanos();
  preencherInfoUsuario();
});