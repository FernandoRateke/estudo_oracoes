# Oração Subordinada Substantiva × Adverbial

Apresentação escolar em formato de site, com um vídeo curto de revisão em 3D.

- **Substantiva** (azul): a peça de quebra-cabeça que **completa** a oração principal.
- **Adverbial** (laranja): a etiqueta que **acrescenta uma circunstância** (tempo, causa, condição…).

## Como apresentar

1. Abra o `index.html` no navegador. Também funciona publicado pelo GitHub Pages.
2. Use os atalhos:

| Tecla | Ação |
|---|---|
| ← → (ou Page Up / Page Down) | Volta ou avança um slide |
| N | Mostra as notas de fala do slide |
| F | Tela cheia |
| Home / End | Vai para o primeiro ou para o último slide |

3. Na capa, clique nos campos (nomes, turma, professor(a), data) e digite. O que você escreve fica salvo no navegador daquele computador.
4. Para abrir um slide direto pelo endereço, use `index.html#slide-13` (troque o número).

No celular, os slides aparecem um embaixo do outro, para rolar.

## Roteiro (17 slides)

1. Capa
2. A pergunta: "Não sei **se** ele vem" × "**Se** ele vem, eu fico"
3. Período composto por subordinação
4. A grande ideia: a oração faz o papel de uma palavra
5. Substantiva: a peça que completa (interativo)
6. Os 6 tipos de substantivas
7. Adverbial: a etiqueta de circunstância (interativo)
8. Os 9 tipos de adverbiais
9. Os 3 testes: "isso", pergunta, retirada (interativo)
10. Comparação lado a lado
11. Pegadinhas: QUE, SE, QUANDO, COMO (cartões para revelar)
12. Cuidados extras: "que" relativo e orações reduzidas
13. Questão de vestibular: Fuvest (clique nas alternativas)
14. Quiz relâmpago
15. Revisão em vídeo (`video.mp4`, cerca de 1 minuto, sem som)
16. Resumo e referências
17. Agradecimento

## Questão de vestibular usada

**Fuvest.** No período "Era tal a serenidade da tarde, que se percebia o sino de uma freguesia distante, dobrando a finados.", a segunda oração é:

a) subordinada adverbial causal
b) subordinada adverbial consecutiva
c) subordinada adverbial concessiva
d) subordinada adverbial comparativa
e) subordinada adverbial subjetiva

**Resposta: b.** O par "tal … que" indica consequência. Em algumas reproduções da questão, a alternativa (e) aparece como "subordinada substantiva subjetiva". Em qualquer versão, a resposta é a mesma.

## Referências

- BECHARA, Evanildo. *Moderna Gramática Portuguesa*.
- CUNHA, Celso; CINTRA, Lindley. *Nova Gramática do Português Contemporâneo*.
- CEGALLA, Domingos Paschoal. *Novíssima Gramática da Língua Portuguesa*.
- Nomenclatura Gramatical Brasileira (NGB), 1959.

## Como o vídeo foi feito (`video-fonte/`)

A cena é feita com Three.js e renderizada quadro a quadro no Chromium (Playwright). Depois o ffmpeg monta o MP4.

```bash
cd video-fonte
npm install
node render.js preview 5,20,40
node render.js video ../video.mp4 30
```

O primeiro comando gera alguns quadros de teste em `video-fonte/preview/`. O segundo gera o vídeo completo.
