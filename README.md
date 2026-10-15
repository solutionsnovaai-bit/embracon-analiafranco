# Ranking Embracon Anália Franco

Painel de ranking de vendas da franquia: placar da meta, posição dos consultores, ranking das equipes, últimas vendas e crédito por categoria.

Site estático, sem build e sem dependências. Os números ficam em um único arquivo, `data/ranking.json`.

## Estrutura

```
index.html                 página do painel
assets/styles.css          estilos
assets/app.js              lógica do painel
assets/logo-embracon.png          logo original, usado no tema claro
assets/logo-embracon-branco.png   logo branco, usado no tema vermelho
assets/marca/              logo em camadas (mão em 4 traços, "Consórcio", "Embracon") para as animações
data/ranking.json          dados: metas, consultores (com equipe) e vendas
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
  "vendas": [
    { "consultor": "nome-do-consultor", "valor": 300000, "categoria": "imovel", "data": "2026-10-02" }
  ]
}
```

| Campo | O que é |
| --- | --- |
| `config.meta` | Meta da franquia no ciclo, em reais, sem pontos nem centavos. |
| `config.metaEquipe` | Meta de cada equipe na ATA. Aparece no ranking de equipes com o quanto falta. |
| `config.ciclo` | Nome do ciclo exibido no placar (opcional). |
| `config.inicio` e `config.prazo` | Datas do ciclo em `AAAA-MM-DD`. Só as vendas dentro desse intervalo entram no placar. Com as duas preenchidas, a régua mostra o ritmo esperado para hoje. |
| `config.exemplo` | `true` exibe a faixa avisando que os dados são de exemplo. Use `false` com os dados reais. |
| `consultores[].id` | Identificador curto, sem espaços nem acentos. É o que liga a venda ao consultor. |
| `consultores[].foto` | Foto da bolinha do consultor (opcional), por exemplo `assets/consultores/juliana-delgado.jpg`. Quadrada, de preferência 320 × 320. Sem foto, a bolinha mostra as iniciais. |
| `consultores[].equipe` | Nome da equipe do consultor (Esquadrão Alpha, Artilheiros, Lekos). Escreva sempre igual para todos da mesma equipe. A ordem em que as equipes aparecem no arquivo é a ordem de desempate. |
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

Cada consultor tem a equipe embaixo do nome no ranking. Na lateral, o **Ranking de equipes** soma o crédito vendido no ciclo por equipe e ordena as três, com a quantidade de consultores, de cotas e de quem já bateu a meta individual.

## Temas

O botão **Tema vermelho** inverte as cores: a página assume o vermelho da marca, os detalhes ficam brancos e o logo troca para a versão branca. **Tema claro** volta ao padrão. A escolha fica guardada no navegador em que foi feita, então o telão pode ficar em um tema e o celular de cada um em outro.

## Tela de abertura

A mão da Embracon se monta traço por traço no centro da tela, desliza para o lugar dela no logo, "Consórcio" e "Embracon" entram e a barra enche com a porcentagem. Quando os dados chegam, uma lâmina na cor de destaque cruza a tela na diagonal e abre o painel, com as barras crescendo do zero. A abertura acompanha o tema: mão vermelha e letras pretas no claro, tudo branco no vermelho.

## Movimento

O painel foi feito para ficar passando no telão, então nunca fica parado:

- **Barras:** listras correm na inclinação dos dedos da mão e um brilho atravessa cada barra de tempos em tempos. No tema claro o preenchimento é vermelho; no vermelho, branco.
- **Destaques:** embaixo do total, uma frase troca a cada 6,5 segundos (quem lidera, equipe na frente, última venda, quanto falta). As palavras saem por cima e entram por baixo.
- **Ao vivo:** o topo alterna entre a hora da última atualização dos números e a hora em que o painel conferiu o arquivo pela última vez.
- **Faixa ao vivo:** no rodapé, um letreiro corre com o placar, as equipes, os primeiros colocados e as últimas vendas.
- **Venda nova:** quando a conferência automática encontra vendas novas, um aviso desce no topo da tela com o nome, a equipe e o valor.
- **Onda:** a cada 45 segundos, os nomes e valores do ranking somem e voltam, de cima para baixo.
- **Mão de fundo:** no placar, uma mão grande faz uma onda com os dedos.

Quem usa o sistema com a opção de reduzir movimento ativada vê o painel parado.

## Usar no telão

O botão **Modo telão** coloca o painel em tela cheia, aumenta a escala e mantém a tela ligada. Sem o `#editar` no endereço, o painel fica somente leitura, que é a versão indicada para a TV e para compartilhar com a equipe.

No modo telão a página rola sozinha para mostrar o ranking inteiro: fica 9 segundos no topo, desce devagar até o fim, espera e volta. Um toque, uma rolagem ou uma tecla pausa a rolagem por 20 segundos.

Para a TV já abrir no modo telão, use o endereço com `#telao` no fim (por exemplo `https://seu-endereco/#telao`). A tela cheia continua pedindo um clique no botão ou a tecla F11.

## Observações

- A página pede aos buscadores que não a indexem (`noindex`), mas o endereço publicado é público para quem tiver o link. Para restringir o acesso, use a proteção por senha da hospedagem.
- O repositório vem com os 19 consultores cadastrados nas três equipes e nenhuma venda lançada: o placar começa em R$ 0. O nome do ciclo e as datas de início e fim estão em branco; preencha em Ajustes ou direto no `ranking.json`.
