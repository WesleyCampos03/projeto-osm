# Gestão Tech

Aplicação web para organizar ganhos e gastos e transformá-los em painéis financeiros e de vendas. Permite cadastrar registros, usar uma planilha compartilhada do Google Sheets, importar CSV ou Excel (.xlsx), filtrar períodos e visualizar resultados em gráficos interativos.

O painel pode usar uma planilha Google compartilhada como fonte de dados. Cada pessoa entra na própria conta Google, escolhe a planilha no Drive e precisa ter permissão de edição nela. Sem conexão, o app continua salvando localmente no navegador.

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

- **Financeiro:** ganhos, gastos e saldo.
- **Vendas:** ganhos com vendas, quantidade de vendas e ticket médio.
- **Período:** mostra um mês ou todo o período.
- **Por mês / Por categoria:** altera o agrupamento dos gráficos.
- **Colunas / Linha / Rosca:** alterna a visualização dos valores filtrados.
- **Comparar períodos:** compare ganhos, gastos e saldo (ou indicadores de vendas) entre dois meses selecionados.
- **Distribuição por categoria:** mostra onde se concentram os ganhos ou gastos. Nos exemplos financeiros, a barra verde representa Marketing.
- **PowerPoint / Exportar PDF:** gera uma apresentação de três páginas com indicadores, gráficos mensais e principais categorias. Os dados acompanham o modelo e o período selecionados.

Os botões Financeiro e Vendas aparecem somente em Meu painel. O modelo Vendas inclui ganhos nos gráficos; gastos continuam disponíveis no modelo Financeiro.

### Meus dados

1. Clique em **Adicionar registro**.
2. Informe data, descrição, categoria, tipo (ganho ou gasto) e valor.
3. Clique em **Salvar registro**.
4. Volte a Meu painel para visualizar os resultados.

É possível editar registros, excluir com confirmação e pesquisar pela descrição ou categoria. Os filtros de período e categoria também se aplicam à tabela. O contador acompanha os filtros e os cálculos são atualizados após cada alteração.

**Planilha compartilhada** conecta o sistema à aba `Gestao Tech` do Google Sheets. Mudanças independentes são mescladas quando possível; edições concorrentes detectadas no mesmo registro pedem uma escolha antes de salvar. Ao conectar pela primeira vez, os dados locais só são enviados depois de confirmar.

**Importar CSV ou XLSX** continua disponível para trazer dados de arquivos. A importação mescla os registros com os dados atuais e pede confirmação antes de somar linhas repetidas. **Carregar exemplos** substitui o conjunto atual.

**Exportar todos os dados** baixa um CSV de backup, inclusive registros que não aparecem no filtro atual. Ele pode ser aberto no Google Sheets, inclusive pelo celular.

### Configurar a conexão com Google Sheets

Esta configuração é feita uma vez pela pessoa responsável pelo sistema. Os usuários finais não precisam de Apps Script.

1. No Google Cloud Console, crie ou escolha um projeto e habilite **Google Sheets API** e **Google Picker API**.
2. Configure a tela de consentimento OAuth e crie um **ID do cliente OAuth para aplicativo da Web**. Cadastre como origem autorizada o domínio do site e `http://localhost:5173` para desenvolvimento. Durante os testes, adicione as contas da equipe como testadoras.
3. Crie uma chave de API para o Google Picker, restringindo-a à API do Picker e aos domínios do site e `https://docs.google.com/*`. O Picker também usa o número do projeto Cloud como App ID.
4. Copie `.env.example` para `.env.local` e preencha `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` e `VITE_GOOGLE_APP_ID`. Em hospedagem contínua, configure as mesmas variáveis no ambiente de build e publique novamente o site.
5. No app, abra **Meus dados → Entrar com Google e escolher planilha**. Selecione a planilha da equipe e aceite o acesso ao arquivo.
6. Compartilhe essa mesma planilha com as contas Google da equipe, com permissão de edição. Cada pessoa conecta a planilha no app usando a própria conta.

O app pede o escopo `drive.file`, para acessar arquivos selecionados pelo usuário no seletor do Google. Tokens de acesso ficam apenas na memória da página; ao abrir o app novamente, basta conectar de novo. O Google Picker requer projeto Cloud, API habilitada, chave de API e token OAuth. [Guia oficial de configuração do OAuth](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) · [Guia do Google Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker).

### Guia de uso

Explica o cadastro de dados, os modelos, os indicadores e a exportação. Também permite baixar um CSV de exemplo.

## Como os indicadores são calculados

| Indicador          | Cálculo                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| Ganhos             | Soma dos registros do tipo `receita` no período                             |
| Gastos             | Soma dos registros do tipo `despesa` no período                             |
| Saldo              | Ganhos menos gastos                                                         |
| Vendas registradas | Quantidade de ganhos no período                                             |
| Ticket médio       | Total de ganhos dividido pela quantidade de vendas; zero sem vendas         |

No modelo Vendas, **cada linha de ganho deve representar uma venda**. Registrar o total mensal em uma única linha fará o sistema contar apenas uma venda e distorcerá o ticket médio.

Exemplo: duas vendas de R$ 200 e R$ 300, com um gasto de R$ 100, resultam em R$ 500 de ganhos, R$ 100 de gastos, R$ 400 de saldo, duas vendas e ticket médio de R$ 250.

Os gráficos agrupam os valores por mês ou categoria. Colunas e linhas comparam ganhos e gastos no modelo Financeiro. A rosca mostra a composição dos registros; a lista ao lado detalha ganhos, gastos ou vendas por categoria.

## Formato do CSV

São obrigatórias colunas equivalentes a `data`, `descricao`, `categoria`, `tipo` e `valor`. A ordem pode variar. Em Excel, o sistema seleciona a primeira aba que contém essas colunas; títulos e cabeçalhos devem estar na primeira linha. Os formatos aceitos são `.xlsx` e CSV.

```csv
data;descricao;categoria;tipo;valor
2026-10-01;Venda de camisetas;Produtos;ganho;250,00
2026-10-02;Compra de embalagens;Materiais;gasto;40,00
2026-10-03;Divulgação;Marketing;gasto;65,00
```

Regras de validação:

- Data válida em **AAAA-MM-DD** ou **DD/MM/AAAA**.
- Descrição preenchida, com até 120 caracteres.
- Categoria preenchida, com até 60 caracteres.
- Tipo `ganho` ou `gasto`. Os valores antigos `receita` e `despesa` também são aceitos.
- Valor positivo, até R$ 1 bilhão por registro, com até duas casas decimais e sem o símbolo R$.
- Arquivo de até **2 MB**, com até **5.000 registros**.

O importador aceita ponto e vírgula como separador e vírgula decimal, ou vírgula como separador e ponto decimal. Aceita textos entre aspas, aspas escapadas e cabeçalhos acentuados, como `descrição`. Arquivos inválidos não alteram os dados existentes.

Baixe um modelo em **Meus dados → Baixar arquivo de exemplo**. Planilhas podem ser exportadas como CSV ou importadas diretamente como XLSX.

## Salvamento e backup

Os registros ficam na planilha escolhida quando o Google Sheets está conectado. O navegador mantém uma cópia local de apoio; sem a conexão, os dados ficam apenas nesse navegador.

- Sem conexão com a planilha, cada navegador e endereço do site têm seus próprios dados.
- Com conexão, as contas Google que têm acesso de edição à mesma planilha compartilham os registros em outros dispositivos.
- Apagar os dados de navegação pode remover os registros.
- Em navegação privada ou com armazenamento bloqueado, o salvamento pode falhar; a interface mostra um aviso.
- Se os dados salvos não puderem ser lidos, a aplicação não os substitui automaticamente. Confirme a substituição para salvar os dados da sessão, ou importe um CSV válido e confirme a importação.

Use **Exportar todos os dados** para criar um backup CSV. **Importar CSV ou XLSX** permite recuperar esse backup ou transferir registros de outro sistema. A conexão com Google Sheets exige internet; o cache offline guarda os arquivos do site, não a sincronização com a planilha.

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

## Testes

Execute os testes de cálculos, importação/exportação e interações da interface:

```powershell
npm test
```

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
│   ├── google-sheets.js # Autorização, seleção e sincronização com Sheets API
│   ├── index.css        # Fonte e estilos globais
│   └── main.jsx         # Inicialização do React e cache offline
├── tests/data.test.js   # Testes dos cálculos e do CSV
├── index.html           # Página base e metadados
├── vite.config.js       # Build, caminhos relativos e cache
├── package.json         # Dependências e comandos
└── package-lock.json    # Versões das dependências
```

**React** organiza a interface e atualiza as telas quando os dados mudam. **CSS e SVG** desenham os gráficos e o visual. **Vite** executa o ambiente de desenvolvimento e gera os arquivos para publicação. Google Identity Services autoriza cada usuário, o Google Picker seleciona a planilha e a Sheets API lê e atualiza os dados. Os arquivos antigos em `apps-script/` não fazem parte desta conexão.

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

O sistema não tem contas próprias; a autorização e as permissões da planilha são gerenciadas pela conta Google de cada usuário. A integração exige as credenciais públicas do projeto Google Cloud configuradas no build. Sem elas, o modo local continua disponível. A sincronização detecta alterações remotas e faz mesclagem otimista; para serialização rigorosa das gravações simultâneas seria necessário um serviço de backend com bloqueio compartilhado.
