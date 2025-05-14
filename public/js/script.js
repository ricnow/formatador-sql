document.addEventListener('DOMContentLoaded', () => {
    // Botão de formatar
    const formatarBtn = document.getElementById('formatar-btn');
    if (formatarBtn) {
        formatarBtn.addEventListener('click', async () => {
            const input = document.getElementById('input-sql').value.trim();
            if (!input) return;

            try {
                const resposta = await fetch('/formatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sql: input }),
                });

                const dados = await resposta.json();

                if (resposta.ok && dados.formatada) {
                    adicionarBlocoSQL(dados.formatada);
                } else if (dados.erro) {
                    mostrarErro(dados.erro); // Mostra o erro real retornado pelo servidor
                } else {
                    mostrarErro("Erro ao formatar SQL. Verifique se o código está válido.");
                }
                
            } catch (erro) {
                console.error('Erro na requisição:', erro);
                mostrarErro("Erro de comunicação com o servidor. Tente novamente.");
            }
        });
    }

    // Upload de arquivo .sql
    const uploadInput = document.getElementById('upload-input');
    if (uploadInput) {
        uploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file || !file.name.endsWith('.sql')) return;

            const text = await file.text();
            const inputArea = document.getElementById('input-sql');
            if (inputArea) {
                inputArea.value = text;
                formatarBtn?.click();
            }
        });
    }

    // Alternar tema
    const toggleTheme = document.getElementById('toggle-theme');
    if (toggleTheme) {
        toggleTheme.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });
    }
});

// Função para adicionar o bloco de código formatado
function adicionarBlocoSQL(sqlFormatado) {
    const container = document.createElement('div');
    container.classList.add('bloco-sql', 'fade-in');

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.classList.add('language-sql');
    code.textContent = sqlFormatado;

    pre.appendChild(code);
    container.appendChild(pre);

    const copiarBtn = document.createElement('button');
    copiarBtn.classList.add('icon-btn', 'copiar-btn');
    copiarBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copiarBtn.title = 'Copiar código';
    copiarBtn.onclick = () => {
        navigator.clipboard.writeText(sqlFormatado).then(() => {
            copiarBtn.innerHTML = '<i class="fas fa-check"></i>';
            copiarBtn.title = 'Copiado!';
            setTimeout(() => {
                copiarBtn.innerHTML = '<i class="fas fa-copy"></i>';
                copiarBtn.title = 'Copiar código';
            }, 1500);
        });
    };

    const removerBtn = document.createElement('button');
    removerBtn.classList.add('icon-btn', 'remover-btn');
    removerBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    removerBtn.title = 'Remover';
    removerBtn.onclick = () => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 300);
    };

    const botoes = document.createElement('div');
    botoes.classList.add('botoes');
    botoes.appendChild(copiarBtn);
    botoes.appendChild(removerBtn);

    container.appendChild(botoes);
    document.getElementById('resultado').prepend(container);
    Prism.highlightElement(code);
}


function mostrarErro(mensagem) {
    const resultado = document.getElementById('resultado');
    const erroEl = document.createElement('div');
    erroEl.classList.add('erro-sql');
    erroEl.textContent = mensagem;

    const fecharBtn = document.createElement('button');
    fecharBtn.innerHTML = '<i class="fas fa-times"></i>';
    fecharBtn.classList.add('fechar-erro');
    fecharBtn.onclick = () => erroEl.remove();

    erroEl.appendChild(fecharBtn);
    resultado.prepend(erroEl);

    setTimeout(() => erroEl.remove(), 5000);
}

const textarea = document.getElementById('input-sql');
const lineNumbers = document.getElementById('line-numbers');
const scrollSync = document.querySelector('.scroll-sync');

function atualizarNumerosDeLinha() {
    const totalLinhas = textarea.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: totalLinhas }, (_, i) => i + 1).join('<br>');
}

textarea.addEventListener('input', atualizarNumerosDeLinha);

// Sincronizar scroll da numeração
textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
});

// Atualizar ao carregar
atualizarNumerosDeLinha();
