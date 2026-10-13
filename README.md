# Gestão Tech

Aplicação web para organizar receitas e despesas e transformá-las em painéis financeiros e de vendas. Permite cadastrar registros, importar CSV, filtrar períodos e visualizar os resultados em gráficos interativos.

Esta versão funciona no navegador, com salvamento local e sem cadastro de conta. Os dados iniciais são exemplos fictícios, que podem ser substituídos pelos registros do usuário.

## Requisitos

- **Node.js 22.12 ou superior**, com npm. O Vite também aceita versões 20.x a partir da 20.19.
- **Git**, para clonar o repositório. Também é possível baixar e extrair um ZIP pelo GitHub.
- Navegador atualizado.

Confira a instalação das ferramentas no terminal:

```powershell
node --version
npm --version
git --version
```

## Como instalar e executar

### 1. Baixe o projeto

No GitHub, copie a URL HTTPS em **Code**. Substitua `URL_DO_REPOSITORIO` no comando abaixo pela URL copiada:

```powershell
git clone "URL_DO_REPOSITORIO" projetoOSM
cd projetoOSM
```

Se já tiver a pasta do projeto ou tiver baixado um ZIP, abra o terminal nessa pasta. Ela deve conter o arquivo `package.json`.

### 2. Instale as dependências

```powershell
npm ci
```

Esse comando instala as versões registradas no `package-lock.json` e precisa de internet. Não é necessário instalar novamente a cada execução.

### 3. Inicie a aplicação

```powershell
npm run dev
```

Abra o endereço informado no terminal, normalmente `http://localhost:5173`. Se a porta estiver ocupada, o Vite informará outra. Mantenha o terminal aberto durante o uso; para encerrar, pressione **Ctrl+C**.

No Windows, se o PowerShell bloquear `npm.ps1`, substitua `npm` por `npm.cmd`, por exemplo `npm.cmd run dev`.

## Como funciona

### Meu painel

Exibe os indicadores e gráficos calculados a partir dos registros.

- **Financeiro:** receitas, despesas e saldo.
- **Vendas:** receita de vendas, quantidade de vendas e ticket médio.
- **Período:** mostra um mês ou todo o período.
- **Por mês / Por categoria:** altera o agrupamento do gráfico de colunas.
- **Distribuição por categoria:** mostra onde se concentram as despesas ou receitas. Nos exemplos financeiros, a barra verde representa Marketing.
- **Imprimir:** abre a impressão do navegador; escolha Salvar como PDF para guardar o painel.

Os botões Financeiro e Vendas aparecem somente em Meu painel. O modelo Vendas inclui receitas nos gráficos; despesas continuam disponíveis no modelo Financeiro.

### Meus dados

1. Clique em **Adicionar registro**.
2. Informe data, descrição, categoria, tipo (receita ou despesa) e valor.
3. Clique em **Salvar registro**.
4. Volte a Meu painel para visualizar os resultados.

É possível editar registros, excluir com confirmação e pesquisar pela descrição ou categoria. O filtro de período também se aplica à tabela. Os cálculos são atualizados após cada alteração.

**Importar CSV** valida o arquivo e solicita confirmação antes de substituir os dados. **Carregar exemplos** também substitui o conjunto atual. Exporte um backup antes dessas operações para preservar seus registros.

**Exportar CSV** baixa todos os registros, inclusive os que não aparecem no filtro atual. O arquivo pode ser importado em outro navegador ou computador.

### Guia de uso

Explica o cadastro de dados, os modelos, os indicadores e a exportação. Também permite baixar um CSV de exemplo.

## Como os indicadores são calculados

| Indicador          | Cálculo                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| Receitas           | Soma dos registros do tipo `receita` no período                             |
| Despesas           | Soma dos registros do tipo `despesa` no período                             |
| Saldo              | Receitas menos despesas                                                     |
| Vendas registradas | Quantidade de registros do tipo `receita` no período                        |
| Ticket médio       | Receita total dividida pela quantidade de vendas; zero quando não há vendas |

No modelo Vendas, **cada linha de receita deve representar uma venda**. Registrar a receita mensal em uma única linha fará o sistema contar apenas uma venda, distorcendo o ticket médio.

Exemplo: duas vendas de R$ 200 e R$ 300, com uma despesa de R$ 100, resultam em R$ 500 de receitas, R$ 100 de despesas, R$ 400 de saldo, duas vendas e ticket médio de R$ 250.

Os gráficos de colunas somam os valores por mês ou categoria. As barras horizontais consideram despesas no modelo Financeiro e receitas no modelo Vendas.

## Formato do CSV

São obrigatórias as colunas `data`, `descricao`, `categoria`, `tipo` e `valor`. A ordem pode variar; não pode haver cabeçalhos duplicados.

```csv
data;descricao;categoria;tipo;valor
2026-10-01;Venda de camisetas;Produtos;receita;250,00
2026-10-02;Compra de embalagens;Materiais;despesa;40,00
2026-10-03;Divulgação;Marketing;despesa;65,00
```

Regras de validação:

- Data válida em **AAAA-MM-DD**.
- Descrição preenchida, com até 120 caracteres.
- Categoria preenchida, com até 60 caracteres.
- Tipo `receita` ou `despesa`.
- Valor positivo, até R$ 1 bilhão por registro, com até duas casas decimais e sem o símbolo R$.
- Arquivo de até **2 MB**, com até **5.000 registros**.

O importador aceita ponto e vírgula como separador e vírgula decimal, ou vírgula como separador e ponto decimal. Aceita textos entre aspas, aspas escapadas e cabeçalhos acentuados, como `descrição`. Arquivos inválidos não substituem os dados existentes.

Baixe um modelo em **Meus dados → Baixar arquivo de exemplo**. Planilhas devem ser exportadas como CSV; arquivos XLSX não são importados diretamente.

## Salvamento e backup

Os registros ficam no `localStorage`, armazenamento do próprio navegador. Não são enviados a um banco de dados ou servidor da aplicação.

- Cada navegador e endereço do site têm seus próprios dados.
- Outro computador, domínio ou porta não recupera automaticamente os registros anteriores.
- Apagar os dados de navegação pode remover os registros.
- Em navegação privada ou com armazenamento bloqueado, o salvamento pode falhar; a interface mostra um aviso.

Use **Exportar CSV** para backup e **Importar CSV** para transferir registros. O cache offline guarda os arquivos do site; o CSV é a cópia de segurança dos dados do usuário.

## Preparar para hospedagem

Gere os arquivos de produção:

```powershell
npm run build
```

A saída fica na pasta `dist`. Para conferir o resultado localmente:

```powershell
npm run preview
```

Abra o endereço informado, normalmente `http://localhost:4173`. O comando preview serve para conferir o build localmente. Para publicar, envie o conteúdo de `dist` a uma hospedagem de sites estáticos ou configure estas etapas na plataforma:

| Configuração       | Valor           |
| ------------------ | --------------- |
| Instalação         | `npm ci`        |
| Build              | `npm run build` |
| Diretório de saída | `dist`          |

O projeto usa caminhos relativos, permitindo hospedagem em subpastas. Use HTTPS para habilitar o acesso offline. O build não publica o site automaticamente; enviar o código ao GitHub também exige configurar a hospedagem para disponibilizar a aplicação.

## Acesso offline

A versão de produção usa um service worker para armazenar HTML, JavaScript, CSS, fonte e ícone. A fonte Manrope é incluída localmente; o uso não depende de uma CDN.

1. Abra a versão de produção servida por HTTPS ou localhost.
2. Aguarde **Disponível para acesso offline neste navegador**.
3. Reabra o mesmo endereço sem conexão e confira o funcionamento.

`npm run dev` não instala esse cache. Abrir `dist/index.html` diretamente com `file://` não é suportado. Para executar sem internet, prepare as dependências e o build previamente e use um servidor HTTP local, como `npm run preview`.

Um servidor na rede local pode atender outros dispositivos enquanto a rede estiver disponível. Service workers exigem contexto seguro; um endereço HTTP de IP local geralmente não permite instalar o cache.

## Estrutura e tecnologias

```text
projetoOSM/
├── public/              # Arquivos estáticos e ícone
├── src/
│   ├── assets/          # Fonte local e licença
│   ├── App.jsx          # Telas, navegação e interações
│   ├── App.css          # Layout, gráficos e responsividade
│   ├── data.js          # Exemplos, cálculos, agrupamentos e CSV
│   ├── index.css        # Fonte e estilos globais
│   └── main.jsx         # Inicialização do React e cache offline
├── tests/data.test.js   # Testes dos cálculos e do CSV
├── index.html           # Página base e metadados
├── vite.config.js       # Build, caminhos relativos e cache
├── package.json         # Dependências e comandos
└── package-lock.json    # Versões das dependências
```

**React** organiza a interface e atualiza as telas quando os dados mudam. **CSS e SVG** desenham os gráficos e o visual. **Vite** executa o ambiente de desenvolvimento e gera os arquivos para publicação. Não há backend nesta versão.

## Comandos disponíveis

| Comando           | Função                                 |
| ----------------- | -------------------------------------- |
| `npm ci`          | Instalar dependências do lockfile      |
| `npm run dev`     | Executar em desenvolvimento            |
| `npm run build`   | Gerar a pasta `dist`                   |
| `npm run preview` | Conferir o build localmente            |
| `npm test`        | Verificar cálculos, agrupamentos e CSV |
| `npm run lint`    | Analisar o código com Oxlint           |

## Limites desta versão

Ainda não há contas, autenticação, compartilhamento de painéis, banco de dados na nuvem, integração automática com sistemas externos ou importação direta de Excel. Hospedar o site não muda o armazenamento: os dados continuam no navegador de cada visitante.
