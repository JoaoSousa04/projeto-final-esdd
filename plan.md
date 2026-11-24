# Plano de implementação — Plataforma de Análise de Estruturas e Algoritmos

Fonte: enunciado “Projeto: Plataforma de Análise de Estruturas e Algoritmos”, PDF, p. 1–2. O trabalho é uma avaliação final em equipe de 3 a 4 integrantes.

## Objetivo e responsabilidades

Entregar um sistema em C que ordene os mesmos dados em quatro estruturas, compare tempo e memória, execute testes em lote e exporte eventos para uma interface visual.

| Responsável | Trabalho |
| --- | --- |
| Codex | Implementar a primeira versão completa, elaborar testes e casos de exemplo, executar as verificações disponíveis e redigir o README, a documentação de arquitetura e o registro inicial de prompts. Corrigir os defeitos encaminhados pela equipe e repetir os testes afetados. |
| Equipe | Conferir os requisitos e os padrões da disciplina, analisar o código e as métricas, reproduzir e depurar problemas, verificar as correções e validar a entrega. Cada integrante deve saber explicar o código na arguição. |

**Decisões propostas.** Usar C no núcleo e HTML, CSS e JavaScript na interface, com exportação JSON. O PDF também permite uma interface em Java com Swing ou JavaFX como alternativa. Usar Insertion Sort e Merge Sort crescente nas quatro estruturas, com uma CLI para acionar os modos de execução. Adotar C11 e uma ferramenta de build simples se o repositório e a disciplina não indicarem outra configuração. Confirmar as convenções da disciplina na revisão inicial. Manter todos os requisitos obrigatórios na primeira versão, com a tabela hash como etapa extra.

## Requisitos e critérios de aceite

Os identificadores abaixo servem para ligar o enunciado à implementação, aos testes e à revisão da equipe. Os critérios concretizam as escolhas deste plano.

| ID | Fonte | Requisito | Evidência de aceite |
| --- | --- | --- | --- |
| RF-01 | p. 1 • Alocação dinâmica | Gerenciar dados com ponteiros e alocação dinâmica. | O vetor cresce com `realloc`. Vetor, nós e estruturas auxiliares liberam seus recursos ao terminar ou falhar. Falha em `realloc` preserva o bloco original. |
| RF-02 | p. 1 • Listas lineares | Implementar vetor contíguo e listas simplesmente encadeada, duplamente encadeada e circular. | As quatro estruturas recebem a mesma sequência. A lista dupla mantém `prev` e `next` coerentes, e a circular retorna à cabeça após percorrer exatamente seu tamanho. |
| RF-03 | p. 1 • Listas lineares | Implementar Insertion Sort e Merge Sort nas quatro estruturas. | As oito combinações preservam tamanho, elementos e duplicatas, produzem ordem crescente e mantêm os invariantes. Nas listas, a ordenação efetivamente religa os nós. |
| RF-04 | p. 1 • Alocação e listas | Medir tempo e consumo de memória e comparar listas com vetor. | Um relatório apresenta as oito combinações sob as mesmas condições, com tempo de ordenação, bytes estimados por execução e contagem de comparações. |
| RF-05 | p. 1 • Pilhas | Implementar histórico LIFO e Desfazer no modo passo a passo. | Avançar, desfazer e avançar de novo retorna ao mesmo estado e à mesma etapa. Desfazer no início é tratado sem erro. |
| RF-06 | p. 1 • Filas | Gerenciar testes em lote com uma fila FIFO. | Um lote com pelo menos três tarefas executa na ordem de entrada e informa o resultado individual de cada uma. Uma tarefa inválida ou com erro tem seu resultado registrado. |
| RF-07 | p. 1 • Interface visual | Exportar eventos do programa C e animar a ordenação por barras. | O C gera JSON com estado inicial e todas as comparações e trocas reais. A página carrega um JSON do C, destaca comparações, reproduz trocas ou movimentos e termina no mesmo estado ordenado. |
| RF-08 | p. 1 • Extra | Indexar relatórios por nome do algoritmo com tabela hash e encadeamento exterior. | Busca recupera todos os relatórios da chave, inclusive quando dois nomes distintos caem no mesmo bucket. Uma chave ausente tem resposta definida. |
| RNF-01 | p. 1 • Engenharia de Software | Usar Git/GitHub, levantar requisitos e documentar a arquitetura. | Este plano e a documentação são versionados com a implementação. Os commits permitem relacionar as mudanças aos requisitos e às verificações. |
| RNF-02 | p. 1 • Inglês | Redigir `README.md`, comentários, nomes de variáveis e de funções em inglês. | Revisão do código e do README confirma o idioma e explica como compilar, executar, comparar resultados e abrir o visualizador. |
| RNF-03 | p. 2 • Uso de IA | Entregar `AI_LOG.md` com prompts reais e explicar adaptações e correções. | Cada entrada importante relaciona prompt, requisito, arquivos afetados, alterações realizadas e evidência de verificação. |
| RNF-04 | p. 2 • Uso de IA | Refatorar o código gerado conforme os padrões da disciplina e preparar a arguição individual. | A equipe confere o código contra os padrões aplicáveis, depura casos representativos e cada integrante explica uma ordenação, os invariantes e uma decisão de implementação. |

## Arquitetura proposta

Usar os caminhos abaixo como referência e aproveitar a organização existente do repositório quando houver.

| Componente | Responsabilidade |
| --- | --- |
| `src/structures/` | Vetor dinâmico, três listas, pilha de histórico e fila de tarefas. Cada módulo define a posse dos dados e sua liberação. |
| `src/sorting/` | Ordenações por estrutura, contagem de comparações e emissão opcional de eventos. |
| `src/benchmark/` | Entrada reproduzível, execução isolada, medições e relatório comparativo. |
| `src/trace/` | Contrato de eventos, escrita de JSON e estado reproduzível do modo passo a passo. |
| `src/main.c` | CLI para benchmark, lote, exportação e depuração passo a passo. |
| `web/` | Página estática para abrir um arquivo JSON local, navegar pelos eventos e animar as barras. |
| `tests/` e `docs/architecture.md` | Testes e documentação sobre módulos, invariantes, métricas, formato do JSON e decisões técnicas. |

### Medição e comparação

- Gerar sequências reproduzíveis a partir de tamanho e semente. Cobrir entradas aleatórias, já ordenadas, inversas e com duplicatas. Construir uma cópia equivalente para cada combinação e repetir a execução com a mesma configuração.
- Usar fonte de tempo monotônica quando disponível na plataforma adotada. Cronometrar apenas a ordenação com o mesmo nível de instrumentação em todas as combinações. Exportação, animação, construção da entrada e validação ocorrem fora do trecho medido. Desativar o histórico e a exportação no benchmark.
- Registrar o tamanho da estrutura antes da ordenação, a alocação dinâmica adicional e o pico de bytes solicitados pelo código medido. Na soma, usar capacidade alocada para vetores e tamanho real dos nós para listas. Informar no relatório que essa medida exclui sobrecarga do alocador e da pilha de chamadas. Documentar a recursão usada pelo Merge Sort, se adotada.
- Exportar algoritmo, estrutura, tamanho, perfil de entrada, semente, repetições, tempo por execução, mediana, bytes e comparações. Comparações contam confrontos de valores. Movimentações em vetor e religações de nós podem ser contabilizadas separadamente. Documentar plataforma, compilador e opções usadas na comparação.
- Validar o resultado fora da região cronometrada, comparando-o com uma ordenação de referência além de conferir os invariantes das listas. Registrar falhas sem incluir suas amostras na mediana.

### Eventos e Desfazer

- Versionar o contrato JSON. Incluir `schemaVersion`, algoritmo, estrutura, estado inicial e eventos em ordem numerada. Atribuir IDs estáveis aos elementos, inclusive os de valor igual. Usar eventos `compare`, `swap` e `move`, com os dados necessários para localizar os elementos e aplicar ou inverter as alterações na sequência lógica.
- Instrumentar o algoritmo para registrar cada comparação e cada troca efetiva. Insertion Sort e Merge Sort também podem deslocar elementos ou religar nós. Emitir os movimentos que representam essas mudanças na ordem visual, sem registrar trocas fictícias. No modo de rastreamento, verificar que a reprodução do JSON chega à sequência final do algoritmo em cada estrutura.
- No modo passo a passo em C, aplicar os eventos a um estado visual, manter cursor e destaque atual e empilhar a informação necessária para inverter cada avanço. Ao desfazer, restaurar a ordem, o destaque e o cursor que existiam antes do evento. A visualização web deve seguir o mesmo contrato para reproduzir os eventos e oferecer avanço, retrocesso e reprodução. O modo em C permite demonstrar o uso explícito da pilha.
- Testar exportação vazia, arquivo inválido, versão incompatível e fim da reprodução. Usar uma entrada pequena para demonstrar os passos. Na página, mostrar a origem do evento e a mensagem de erro quando um arquivo não puder ser carregado.

## Etapas de implementação

Cada etapa fica pendente até o Codex disponibilizar código e evidência de teste. A equipe faz a revisão ao receber cada incremento e devolve os problemas com passos de reprodução.

| Etapa | Dependência | Tarefas do Codex | Verificação da equipe |
| --- | --- | --- | --- |
| 1. Base e documentação | Enunciado | Inspecionar repositório e padrões disponíveis. Preparar build, CLI básica, `README.md`, arquitetura e `AI_LOG.md`. Versionar os incrementos no fluxo Git/GitHub adotado pela equipe. | Confirmar a interpretação dos requisitos, o ambiente de compilação e os padrões da disciplina. |
| 2. Estruturas e memória | 1 | Implementar vetor com crescimento seguro, as três listas e seus invariantes. Definir criação, população, iteração, destruição e tratamento de alocação malsucedida. | Inspecionar um crescimento do vetor e seguir os ponteiros em listas vazias, unitárias e com vários nós. |
| 3. Ordenações | 2 | Implementar as oito combinações. Manter a ordenação estável como decisão do plano. Tratar a circular como linear durante a ordenação, se conveniente, e restaurar seu fechamento antes de retornar. Preservar encadeamentos e metadados de cada lista. | Depurar com duplicatas e verificar religações, cabeça, cauda, fechamento e tamanho. |
| 4. Benchmark e lote | 3 | Implementar a medição, o relatório e a fila FIFO. Cada tarefa guarda a configuração de uma combinação de algoritmo, estrutura e entrada. Executar tarefas isoladamente, liberar recursos e continuar o lote quando o erro for restrito à tarefa. | Comparar medições feitas com as mesmas entradas. Checar a ordem FIFO, a identificação das falhas e a unidade de cada métrica. |
| 5. Rastreamento e visualizador | 3 | Implementar exportação JSON, pilha para desfazer no modo passo a passo e interface web estática. Gerar exemplos com o executável real e testar a reprodução ponta a ponta. | Acompanhar uma comparação e uma movimentação até o evento exportado. Depurar `Undo` e confrontar a ordem final da tela com a saída do C. |
| 6. Integração e entrega obrigatória | 4 e 5 | Executar matriz de testes e demonstração completa. Refatorar conforme os padrões confirmados. Atualizar README, arquitetura e AI_LOG com comandos e resultados reais. | Repetir a demonstração em uma cópia limpa, revisar as alterações e praticar a arguição individual. |
| 7. Tabela hash (extra) | 6 | Implementar buckets com listas de colisão. Indexar os relatórios salvos pelo nome do algoritmo, guardando todas as execuções da mesma chave. Ao abrir uma nova sessão, reindexar os relatórios de uma pasta conhecida. | Forçar colisão em teste, buscar nomes distintos no mesmo bucket, recuperar múltiplos relatórios por chave e repetir a busca após reiniciar. |

## Roteiro de validação e depuração

- [ ] Compilar a partir de uma cópia limpa seguindo o README e registrar os comandos usados. Rodar com avisos do compilador e, quando disponíveis, AddressSanitizer e UndefinedBehaviorSanitizer ou Valgrind.
- [ ] Exercitar as oito ordenações com vetores vazios, unitários, ordenados, inversos, repetidos e com valores negativos. Conferir ordem, preservação dos dados e invariantes após cada execução.
- [ ] Testar crescimento do vetor e liberação das estruturas em caso de sucesso e de falha. Simular falha de alocação quando a infraestrutura de teste permitir.
- [ ] Rodar um lote com as oito combinações sobre a mesma entrada. Conferir a ordem da fila, os resultados verificados, o relatório e a coerência das métricas.
- [ ] Exportar JSON a partir do C, abrir na interface web e conferir o passo a passo. Testar Desfazer após uma comparação e após um movimento, retroceder até o início e avançar novamente até o estado final.
- [ ] Para cada defeito, registrar o ID do requisito, comando ou ação, entrada e semente, resultado esperado e observado, trecho do código e evidência. Após a correção do Codex, a equipe repete o cenário e confere os fluxos afetados.
- [ ] Se o extra for implementado, testar colisões, chave ausente, múltiplos relatórios da mesma chave e busca em uma nova sessão.

## Registro acadêmico e entrega

- [ ] Criar `AI_LOG.md` desde a primeira etapa. Para cada prompt relevante, registrar o texto efetivamente usado, a resposta ou mudança produzida, o que foi adaptado ou corrigido, por quem e como foi validado. A equipe acrescenta as observações reais de análise e depuração.
- [ ] Conferir que o README em inglês ensina a compilar, executar testes, rodar um benchmark comparativo, executar um lote, exportar e visualizar um JSON e acionar o modo passo a passo. Documentar a busca hash caso o extra seja entregue.
- [ ] Versionar código, requisitos, arquitetura, README e AI_LOG no repositório adotado. Registrar os resultados da validação por requisito, com falhas pendentes explícitas.
- [ ] Cada integrante pratica explicar alocação e liberação, manipulação de ponteiros em uma ordenação, FIFO e LIFO, cálculo das métricas e percurso de um evento do C até a tela. Usar um caso real depurado pela equipe como exemplo de adaptação ou correção.
- [ ] Considerar a parte obrigatória pronta quando RF-01 a RF-07 e RNF-01 a RNF-04 estiverem verificados e a equipe conseguir reproduzir a demonstração em uma cópia limpa. Conferir RF-08 se o extra for incluído.
