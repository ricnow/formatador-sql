const express = require('express');
const bodyParser = require('body-parser');
const formatter = require('sql-formatter');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Remover as aspas simples duplicadas
function removerAspasDuplicadas(texto) {
    return texto.replace(/''([^']*?)''/g, "'$1'");
}

// Nova função: Remove a primeira aspa simples antes de vírgula (',)
// que aparece **depois do último WHERE**
function removerAspaAntesDaVirgulaDepoisDoUltimoWhere(sql) {
    const whereIndex = sql.toUpperCase().lastIndexOf('WHERE');
    if (whereIndex === -1) return sql; // Nenhum WHERE encontrado

    const depoisDoWhere = sql.slice(whereIndex);
    const match = depoisDoWhere.match(/'(,)/);
    if (!match) return sql;

    const relativeIndex = depoisDoWhere.indexOf(match[0]);
    const globalIndex = whereIndex + relativeIndex;

    return sql.slice(0, globalIndex) + "," + sql.slice(globalIndex + 2);
}

// Substitui os parâmetros @P1, @P2... por seus valores no final da string
function substituirParametros(sql) {
    const regexParametros = /@P\d+/g;
    const parametrosEncontrados = [...sql.matchAll(regexParametros)];
    if (parametrosEncontrados.length === 0) return sql;

    let nomesParametros = parametrosEncontrados.map(m => m[0]);

    const partes = sql.split(',');
    let valoresPossiveis = partes.slice(-nomesParametros.length).map(v => v.trim().replace(/;$/, ''));

    if (valoresPossiveis.length < nomesParametros.length) return sql;

    let paresParametroValor = nomesParametros.map((nome, index) => [nome, valoresPossiveis[index]]);

    paresParametroValor.sort((a, b) => {
        const numA = parseInt(a[0].slice(2));
        const numB = parseInt(b[0].slice(2));
        return numB - numA;
    });

    let sqlSemValores = partes.slice(0, -nomesParametros.length).join(',');

    paresParametroValor.forEach(([parametro, valor]) => {
        const regex = new RegExp(parametro, 'g');
        sqlSemValores = sqlSemValores.replace(regex, valor);
    });

    return sqlSemValores;
}

// Função principal de formatação
function formatarSQLPersonalizado(sql) {
    // 1. Remover a aspa simples após último WHERE
    let sqlCorrigida = removerAspaAntesDaVirgulaDepoisDoUltimoWhere(sql);

    // 2. Corrigir aspas simples duplicadas
    sqlCorrigida = removerAspasDuplicadas(sqlCorrigida);

    // 3. Substituir parâmetros
    sqlCorrigida = substituirParametros(sqlCorrigida);

    // 4. Formatar com sql-formatter
    let sqlFormatada = formatter.format(sqlCorrigida, {
        language: 'sql',
        indent: '    ',
        keywordCase: 'upper',
    });


    // 6. Quebra de linha antes de JOINs
    sqlFormatada = sqlFormatada.replace(/\b(INNER|LEFT|RIGHT|FULL)?\s*JOIN\b/gi, match => `\n${match}`);

    return sqlFormatada;
}

// Rota de formatação
app.post('/formatar', (req, res) => {
    const { sql } = req.body;
    if (!sql) {
        return res.status(400).json({ erro: 'SQL não fornecida' });
    }

    const formatada = formatarSQLPersonalizado(sql);
    res.json({ formatada });
});

// Inicia servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
