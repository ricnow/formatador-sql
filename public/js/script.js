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
                adicionarBlocoSQL(dados.formatada);
            } catch (erro) {
                console.error('Erro na requisição:', erro);
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

                // Aguarda o preenchimento e aciona o botão de formatar
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

    // Botão de copiar
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

    // Botão de remover
    const removerBtn = document.createElement('button');
    removerBtn.classList.add('icon-btn', 'remover-btn');
    removerBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    removerBtn.title = 'Remover';
    removerBtn.onclick = () => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 300); // efeito suave
    };

    const botoes = document.createElement('div');
    botoes.classList.add('botoes');
    botoes.appendChild(copiarBtn);
    botoes.appendChild(removerBtn);

    container.appendChild(botoes);

    // Adiciona o bloco ao topo da área de resultado
    document.getElementById('resultado').prepend(container);

    // Realça a sintaxe SQL com PrismJS
    Prism.highlightElement(code);
}
