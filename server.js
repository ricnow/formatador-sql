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
    const regexParametros = /@P\d+\b/g;
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

// Nova função: Parse robusto para output do Profiler (sp_prepexec)
function parseProfilerOutput(input) {
    const execIndex = input.search(/exec\s+sp_prepexec/i);
    if (execIndex === -1) return null;

    let execPart = input.slice(execIndex);

    // 1. Match @handle OUTPUT
    const handleMatch = execPart.match(/exec\s+sp_prepexec\s+(@\w+)\s+output\s*,\s*/i);
    if (!handleMatch) return null;

    let currentPos = handleMatch.index + handleMatch[0].length;
    let remaining = execPart.slice(currentPos);

    // 2. Match @params (NULL or N'...')
    if (remaining.startsWith('NULL')) {
        currentPos += 4;
    } else {
        const strMatch = remaining.match(/^(N?'(?:''|[^'])*')/);
        if (strMatch) {
            currentPos += strMatch[0].length;
        } else {
            return null;
        }
    }

    // Consume comma
    remaining = execPart.slice(currentPos);
    const commaMatch = remaining.match(/^\s*,\s*/);
    if (!commaMatch) return null;
    currentPos += commaMatch[0].length;
    remaining = execPart.slice(currentPos);

    // 3. Match @stmt (The SQL)
    const stmtMatch = remaining.match(/^(N?'(?:''|[^'])*')/);
    if (!stmtMatch) return null;

    let sqlLiteral = stmtMatch[1];
    currentPos += stmtMatch[0].length;
    remaining = execPart.slice(currentPos);

    // 4. Match remaining parameters (if any)
    let values = [];
    if (remaining.match(/^\s*,\s*/)) {
        let paramsStr = remaining.replace(/^\s*,\s*/, '');
        const newlineIndex = paramsStr.indexOf('\n');
        if (newlineIndex !== -1) {
            paramsStr = paramsStr.substring(0, newlineIndex);
        }
        values = paramsStr.split(',').map(v => v.trim());
    }

    // Clean SQL
    let sql = sqlLiteral.replace(/^N?'|'$/g, '');
    sql = sql.replace(/''/g, "'");

    return { sql, values };
}

// Substitui parâmetros usando valores extraídos explicitamente
function substituirParametrosComValores(sql, values) {
    if (!values || values.length === 0) return sql;

    // Encontrar todos os parâmetros @P1, @P2...
    const regexParametros = /@P\d+\b/g;
    const parametrosEncontrados = [...sql.matchAll(regexParametros)].map(m => m[0]);

    // Criar mapa de substituição
    let mapaSubstituicao = {};
    values.forEach((valor, index) => {
        const nomeParametro = `@P${index + 1}`;
        mapaSubstituicao[nomeParametro] = valor;
    });

    // Ordenar chaves por tamanho decrescente para evitar substituir @P10 como @P1 + 0
    const chavesOrdenadas = Object.keys(mapaSubstituicao).sort((a, b) => {
        const numA = parseInt(a.slice(2));
        const numB = parseInt(b.slice(2));
        return numB - numA;
    });

    let sqlFinal = sql;
    chavesOrdenadas.forEach(param => {
        const valor = mapaSubstituicao[param];
        // Substituir todas as ocorrências
        const regex = new RegExp(param + '\\b', 'g'); // \b para garantir palavra inteira
        sqlFinal = sqlFinal.replace(regex, valor);
    });

    return sqlFinal;
}

// Função principal de formatação
function formatarSQLPersonalizado(sql) {
    let sqlParaFormatar = sql;

    console.log('--- Iniciando Formatação ---');
    // Tenta fazer o parse robusto primeiro
    const parsed = parseProfilerOutput(sql);

    if (parsed) {
        console.log('Profiler detectado!');
        console.log('SQL Extraído:', parsed.sql);
        console.log('Valores:', parsed.values);
        // Se detectou Profiler, usa a lógica nova
        sqlParaFormatar = parsed.sql;
        sqlParaFormatar = substituirParametrosComValores(sqlParaFormatar, parsed.values);
        console.log('SQL com Parâmetros Substituídos:', sqlParaFormatar);
    } else {
        console.log('Profiler NÃO detectado. Usando fallback.');
        // Fallback para lógica antiga (se não for sp_prepexec ou falhar)
        // 1. Remover a aspa simples após último WHERE
        sqlParaFormatar = removerAspaAntesDaVirgulaDepoisDoUltimoWhere(sqlParaFormatar);

        // 2. Corrigir aspas simples duplicadas
        sqlParaFormatar = removerAspasDuplicadas(sqlParaFormatar);

        // 3. Substituir parâmetros (lógica antiga baseada em vírgulas)
        sqlParaFormatar = substituirParametros(sqlParaFormatar);
    }

    // 4. Formatar com sql-formatter
    try {
        console.log('Tentando formatar com sql-formatter...');
        let sqlFormatada = formatter.format(sqlParaFormatar, {
            language: 'tsql',
            indent: '    ',
            keywordCase: 'upper',
        });
        console.log('Formatação bem sucedida!');

        // 6. Quebra de linha antes de JOINs
        sqlFormatada = sqlFormatada.replace(/\b(INNER|LEFT|RIGHT|FULL)?\s*JOIN\b/gi, match => `\n${match}`);

        return sqlFormatada;
    } catch (e) {
        console.log('CATCH BLOCK REACHED! Erro no sql-formatter:', e.message);
        console.log('Retornando SQL sem formatação devido a erro.');
        return sqlParaFormatar;
    }
}

// Rota de formatação
app.post('/formatar', (req, res) => {
    console.log('Recebido POST /formatar');
    const { sql } = req.body;
    if (!sql) {
        return res.status(400).json({ erro: 'SQL não fornecida' });
    }

    try {
        const formatada = formatarSQLPersonalizado(sql);
        res.json({ formatada });
    } catch (erro) {
        console.log('Erro ao formatar SQL:', erro.message);
        res.status(400).json({
            erro: `Erro ao processar SQL: ${erro.message}`,
        });
    }
});


// Inicia servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
