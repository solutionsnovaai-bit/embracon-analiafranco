# Ranking Embracon Anália Franco

Painel de ranking de vendas da franquia: placar da meta, posição dos consultores, ranking das equipes, últimas vendas e crédito por categoria.

Site estático, sem build e sem dependências. Os números vêm de uma planilha do Google (o jeito mais simples de lançar) ou, sem ela, de um único arquivo, `data/ranking.json`.

## Estrutura

```
index.html                 página do painel
assets/styles.css          estilos do painel de ranking
assets/telas.css           estilos das telas Pódio, Equipes e Mural, da cortina, das mãos do fundo e do confete
assets/app.js              lógica do painel
assets/config.js           link da planilha do Google (vazio: usa data/ranking.json)
assets/logo-embracon.png          logo original colorido (base do logo em vetor do tema claro e ícone da aba)
assets/logo-embracon-branco.png   logo original branco (base do logo em vetor do tema vermelho)
assets/marca/              logo em camadas (mão em 4 traços, "Consórcio", "Embracon") para as animações
assets/consultores/        fotos dos consultores
assets/supervisores/       fotos da supervisão das equipes
data/ranking.json          dados: metas, consultores (com equipe e foto), supervisão das equipes e vendas
planilha/ranking-embracon-analia-franco.xlsx   planilha estilizada para importar no Google
```

## Publicar

Qualquer hospedagem de arquivos estáticos serve.

- **Vercel:** importe o repositório e publique. Não há comando de build nem pasta de saída; a raiz do projeto é o site.
- **GitHub Pages:** em Settings > Pages, escolha a branch `main` e a pasta `/ (root)`.

Para testar no computador, sirva a pasta por um servidor local (abrir o `index.html` direto do disco não consegue ler o `ranking.json` e mostra dados de exemplo):

```
npx serve .
```

## Atualizar os números

### Pela planilha do Google (o jeito mais simples)

A planilha `planilha/ranking-embracon-analia-franco.xlsx` tem duas abas:

- **Ranking:** onde a equipe lança. Cada consultor tem uma linha, e cada venda vai numa casinha cinza ao lado, **em mil**: 50 vira R$ 50.000, 1.000 vira R$ 1 milhão. Total, posição, equipes e o placar da franquia se calculam sozinhos. Metas e datas do ciclo ficam nos cartões do topo.
- **Telão:** alimenta o painel sozinha a partir da aba Ranking. Não precisa mexer.

Para ligar:

1. No Google Drive, clique em **Novo > Upload de arquivo** e envie o `.xlsx`. Abra com o Google Planilhas e use **Arquivo > Salvar como Planilhas Google**.
2. Em **Arquivo > Configurações**, deixe a localidade como **Brasil**. É isso que faz o 50 aparecer como R$ 50.000 e as datas ficarem no formato dia/mês.
3. Clique em **Compartilhar** e, em "Acesso geral", escolha **Qualquer pessoa com o link: Leitor**. Quem vai lançar as vendas entra como **Editor** pelo e-mail.
4. Copie o link da planilha, cole em `assets/config.js` no campo `planilha` e publique no GitHub.

Com a planilha ligada:

- O telão confere a planilha a cada 8 segundos. Cada casinha nova vira uma venda: aparece o aviso de **venda nova**, o ranking se reordena e a venda entra nas últimas vendas.
- A planilha não guarda o dia de cada venda, então o painel anota o dia em que viu cada casinha nova (fica guardado no navegador da TV). As vendas que já estavam lá quando a TV abriu o painel pela primeira vez ficam sem data.
- Cada casinha conta como 1 cota. Uma venda de várias cotas pode ir em várias casinhas.
- Unidade, nome do ciclo e fotos continuam vindo do `data/ranking.json` (relido a cada minuto). A foto é ligada pelo nome, então escreva o nome do consultor igual nos dois lugares. Nome novo na planilha entra no ranking com as iniciais na bolinha.
- Os botões de edição do `#editar` somem, porque quem manda é a planilha.
- Se a planilha não responder (sem internet, compartilhamento desligado), o painel abre com o `data/ranking.json` e tenta a planilha de novo a cada 8 segundos.

### Pelo arquivo data/ranking.json

O painel lê `data/ranking.json` ao abrir e confere o arquivo de novo a cada 60 segundos. Basta publicar uma nova versão do arquivo para o telão atualizar sozinho, com o ranking se reordenando na tela.

### Formato do arquivo

```json
{
  "atualizadoEm": "2026-10-02T12:00:00-03:00",
  "config": {
    "unidade": "Anália Franco",
    "meta": 21000000,
    "metaEquipe": 7000000,
    "ciclo": "Outubro 2026",
    "inicio": "2026-10-01",
    "prazo": "2026-10-31",
    "exemplo": false
  },
  "consultores": [
    { "id": "nome-do-consultor", "nome": "Nome do Consultor", "equipe": "Artilheiros" }
  ],
  "supervisores": [
    { "equipe": "Artilheiros", "nome": "Rafael Ferraz", "cargo": "CEO", "foto": "assets/supervisores/rafael-ferraz.jpg" }
  ],
  "vendas": [
    { "consultor": "nome-do-consultor", "valor": 300000, "categoria": "imovel", "data": "2026-10-02" }
  ]
}
```

| Campo | O que é |
| --- | --- |
| `recarregar` | Comando para recarregar a TV de longe (opcional). Mudou o valor e publicou, a TV recarrega a página em até 1 minuto. Veja "Recarregar a TV de longe". |
| `config.meta` | Meta da franquia no ciclo, em reais, sem pontos nem centavos. |
| `config.metaEquipe` | Meta de cada equipe na ATA. Aparece no ranking de equipes com o quanto falta. |
| `config.ciclo` | Nome do ciclo exibido no placar (opcional). |
| `config.inicio` e `config.prazo` | Datas do ciclo em `AAAA-MM-DD`. Só as vendas dentro desse intervalo entram no placar. Com as duas preenchidas, a régua mostra o ritmo esperado para hoje. |
| `config.exemplo` | `true` exibe a faixa avisando que os dados são de exemplo. Use `false` com os dados reais. |
| `consultores[].id` | Identificador curto, sem espaços nem acentos. É o que liga a venda ao consultor. |
| `consultores[].foto` | Foto da bolinha do consultor (opcional), por exemplo `assets/consultores/juliana-delgado.jpg`. Quadrada, de preferência 320 × 320. Sem foto, a bolinha mostra as iniciais. |
| `consultores[].equipe` | Nome da equipe do consultor (Esquadrão Alpha, Artilheiros, Lekos). Escreva sempre igual para todos da mesma equipe. A ordem em que as equipes aparecem no arquivo é a ordem de desempate. |
| `consultores[].cargo` | Opcional. Texto que aparece embaixo do nome no lugar da equipe (ex.: `CEO Embracon Anália Franco`). As vendas continuam somando para a equipe dele. |
| `supervisores[]` | Quem supervisiona cada equipe: `equipe` (escrita igual à dos consultores), `nome`, `cargo` (ex.: Supervisora, CEO) e `foto` (quadrada, em `assets/supervisores/`). Aparece com foto no cartão da equipe, nos destaques e na faixa ao vivo. Com a planilha do Google ligada, a supervisão continua vindo daqui. |
| `vendas[].consultor` | O `id` do consultor que vendeu. |
| `vendas[].valor` | Crédito vendido, em reais. |
| `vendas[].categoria` | `imovel`, `auto`, `pesados` ou `servicos` (opcional; sem ela a venda entra como não informada). |
| `vendas[].data` | Data da venda em `AAAA-MM-DD` (opcional; sem data, a venda conta no ciclo, mas fica fora dos filtros de 7 dias e hoje). |
| `vendas[].cotas` | Quantas cotas a linha representa (opcional, padrão 1). |
| `atualizadoEm` | Data e hora da última atualização, mostrada no topo do painel. |

O ranking, os totais, os percentuais e o ritmo são calculados a partir das vendas. Não existe total para manter à mão.

### Três formas de atualizar

**1. Pela própria tela.** Abra o painel com `#editar` no fim do endereço (por exemplo `https://seu-endereco/#editar`). Aparecem os botões Lançar venda, Consultores e Ajustes. Em Consultores dá para cadastrar gente nova e trocar alguém de equipe. As alterações ficam salvas só naquele navegador; clique em **Baixar ranking.json** e substitua o arquivo da pasta `data` no repositório para publicar.

**2. Por IA.** Peça ao assistente para acrescentar a venda em `data/ranking.json` seguindo o formato acima e atualizar o `atualizadoEm`. Um commit com o arquivo novo publica a mudança.

**3. Por automação.** Qualquer ferramenta que escreva no GitHub resolve (Make, n8n, GitHub Actions). O fluxo é sempre o mesmo: ler o arquivo, acrescentar um item em `vendas`, gravar de volta.

```
GET  /repos/{dono}/{repositorio}/contents/data/ranking.json
PUT  /repos/{dono}/{repositorio}/contents/data/ranking.json
```

O `PUT` recebe o conteúdo novo em Base64, a mensagem do commit e o `sha` devolvido pelo `GET`.

## Equipes

Cada consultor tem a equipe embaixo do nome no ranking. Na lateral, o **Ranking de equipes** soma o crédito vendido no ciclo por equipe e ordena as três, com a quantidade de consultores, de cotas e quanto falta para a meta da equipe.

Cada cartão traz a foto de quem supervisiona a equipe (Enaila Rocha no Esquadrão Alpha, Rafael Ferraz nos Artilheiros e Diego Lins nos Lekos), dentro de um anel que enche conforme a equipe avança na meta. Para trocar a supervisão, edite `supervisores` no `data/ranking.json` e coloque a foto nova em `assets/supervisores/`.

## Telas

O painel tem quatro telas, na barra logo abaixo do topo:

- **Ranking:** o painel de sempre (placar, ranking de consultores, equipes, últimas vendas e categorias).
- **Pódio:** os três primeiros do ciclo com foto grande, em blocos de pódio que sobem (3º, 2º e 1º, nessa ordem), raios girando atrás do 1º, a mão da Embracon de coroa e chuva de mãozinhas e confete. Embaixo, do 4º ao 8º.
- **Equipes:** uma tela por equipe, com a supervisão em destaque (foto num anel que enche com a meta e mãozinhas em órbita), o total da equipe, quanto falta, quem já vendeu, cotas, participação na franquia e os consultores do time com foto e valor. Os botões no alto trocam de equipe.
- **Mural:** frase grande trocando (slogans e números do momento) e duas faixas de fotos de todo mundo andando em sentidos opostos, com cartões de palavras no meio.

No **modo telão** as telas giram sozinhas: Ranking, Pódio, uma tela para cada equipe (da que está na frente para trás) e Mural, e volta ao Ranking. Tela mais alta que a TV desce até o fim e volta antes de passar. A aba ativa mostra uma barrinha enchendo até a troca e, à direita, o que vem a seguir. Toda troca passa por uma cortina vermelha com a mão da Embracon se montando, mãozinhas voando, o nome da franquia e o nome da tela. Fora do telão, as telas trocam só pelo toque.

## Temas

O botão **Tema vermelho** inverte as cores: a página assume o vermelho da marca, os detalhes ficam brancos e o logo troca para a versão branca. **Tema claro** volta ao padrão. A escolha fica guardada no navegador em que foi feita, então o telão pode ficar em um tema e o celular de cada um em outro.

## Tela de abertura

A mão da Embracon se monta traço por traço no centro da tela, desliza para o lugar dela no logo, "Consórcio" e "Embracon" entram e a barra enche com a porcentagem. Quando os dados chegam, uma lâmina na cor de destaque cruza a tela na diagonal e abre o painel, com as barras crescendo do zero. A abertura acompanha o tema: mão vermelha e letras pretas no claro, tudo branco no vermelho.

## Movimento

O painel foi feito para ficar passando no telão, então nunca fica parado:

- **Barras:** listras correm na inclinação dos dedos da mão e um brilho atravessa cada barra de tempos em tempos. No tema claro o preenchimento é vermelho; no vermelho, branco.
- **Destaques:** embaixo do total, uma frase troca a cada 6,5 segundos (quem lidera, equipe na frente, última venda, quanto falta). As palavras saem por cima e entram por baixo.
- **Ao vivo:** o topo alterna entre a hora da última atualização dos números e a hora em que o painel conferiu o arquivo pela última vez.
- **Faixa ao vivo:** no rodapé, um letreiro corre com o placar, as equipes (com a foto da supervisão), os primeiros colocados e as últimas vendas (com a foto de quem vendeu). O selo AO VIVO tem barrinhas de equalizador, relógio com os dois pontos piscando e um brilho que passa; uma linha fina no alto da faixa enche até a próxima conferência da planilha.
- **Equipes:** a luz dá a volta na borda do cartão da equipe que está na frente, um brilho corre pelo anel de cada supervisão, a foto da supervisão da equipe líder pulsa e, a cada 16 segundos, as fotos da supervisão dão um giro de moeda, uma depois da outra.
- **Valores contando:** quando uma venda entra, o valor do consultor e o da equipe sobem contando até o número novo.
- **Placar:** uma luz corre na borda de cima, como sinal no ar.
- **Mãozinhas:** mãos da Embracon flutuam no fundo da página com os dedos em onda; há mãozinhas nos títulos, uma mão d'água na linha do líder e no cartão da equipe que está na frente, e uma chuva de mãozinhas sai do aviso de venda nova.
- **Venda nova:** quando a conferência automática encontra vendas novas, um aviso desce no topo da tela com o nome, a equipe e o valor.
- **Onda:** a cada 45 segundos, os nomes e valores do ranking somem e voltam, de cima para baixo.
- **Mão de fundo:** no placar, uma mão grande faz uma onda com os dedos.

Quem usa o sistema com a opção de reduzir movimento ativada vê o painel parado.

## Usar no telão

O botão **Modo telão** coloca o painel em tela cheia, aumenta a escala e mantém a tela ligada. Sem o `#editar` no endereço, o painel fica somente leitura, que é a versão indicada para a TV e para compartilhar com a equipe.

No modo telão a página rola sozinha para mostrar o ranking inteiro: fica 9 segundos no topo, desce devagar até o fim (ganhando velocidade no começo e freando no fim), espera e sobe de volta numa subida com aceleração. Ao chegar ao topo, a mão do logo acena. Um toque, uma rolagem ou uma tecla pausa a rolagem por 20 segundos.

O logo do topo é desenhado em vetor, dentro do próprio `index.html`, a partir dos dois PNGs originais. Por isso aparece na hora, junto com o texto, mesmo em TVs com navegador mais lento: não depende de carregar nem de decodificar imagem quando a página volta ao topo.

Para a TV já abrir no modo telão, use o endereço com `#telao` no fim (por exemplo `https://seu-endereco/#telao`). A tela cheia continua pedindo um clique no botão ou a tecla F11.

### Recarregar a TV de longe

Vendas, fotos e nomes entram sozinhos na TV, sem recarregar. Quando sai uma versão nova do site (visual, telas, textos), a TV precisa recarregar a página para pegar. Dá para mandar isso de longe, sem ninguém mexer na TV:

- **Pela planilha (em segundos):** na aba **Telão**, escreva `Recarregar` na primeira linha de uma coluna vazia (por exemplo AM1). Para recarregar a TV, escreva qualquer coisa diferente na casinha logo abaixo (AM2): 1, depois 2, depois 3... Em até 8 segundos a TV recarrega.
- **Pelo arquivo (em até 1 minuto depois de publicar):** mude o valor de `"recarregar"` no `data/ranking.json` (por exemplo a data e a hora de agora) e publique.

O painel guarda o valor que viu ao abrir e só recarrega quando ele muda. Depois de recarregar, volta sozinho no modo telão. A tela cheia do botão **Modo telão** não sobrevive a uma recarga (o navegador exige um clique), então na TV prefira a tela cheia do próprio navegador (F11), que continua depois de recarregar.

## Observações

- A página pede aos buscadores que não a indexem (`noindex`), mas o endereço publicado é público para quem tiver o link. Para restringir o acesso, use a proteção por senha da hospedagem.
- O repositório vem com os 22 consultores cadastrados nas três equipes e nenhuma venda lançada: o placar começa em R$ 0. O nome do ciclo e as datas de início e fim estão em branco; preencha em Ajustes ou direto no `ranking.json`.
