# AI log

## Initial implementation request

````text
Implemente neste repositório a primeira versão da Plataforma de Análise de Estruturas e Algoritmos. Leia o plan.md inteiro antes de editar os arquivos. Use os requisitos, as dependências e os critérios de aceite do plano para conduzir o trabalho.\
\
Você é responsável pela implementação inicial, pelos testes, pela documentação e pelo versionamento de cada incremento no Git/GitHub. A equipe ficará responsável por analisar o código e as métricas, reproduzir e depurar problemas, validar as correções e se preparar para a arguição individual.\
\
## Antes de começar\
\
1\. Inspecione o repositório, as instruções locais, a configuração de build e as convenções existentes. Se o repositório estiver vazio, crie a estrutura inicial prevista no plan.md.\
2\. Confira o estado do Git, a branch atual e o remoto configurado. Preserve as alterações locais da equipe. Siga o fluxo de branches do projeto. Se não houver um fluxo definido, use a branch `feat/sorting-benchmark-platform` e publique os incrementos nela.\
3\. Confirme o destino do push a partir da configuração do repositório. Se houver mais de um destino plausível, solicite o remoto correto antes de publicar.\
\
## Versionamento obrigatório a cada incremento\
\
A cada incremento funcional concluído, execute este ciclo antes de iniciar o próximo:\
\
1\. Rode os testes aplicáveis ao incremento.\
2\. Revise o diff e adicione ao Git somente os arquivos correspondentes à mudança. Mantenha alterações alheias, credenciais, binários compilados e arquivos temporários fora do commit.\
3\. Faça um commit que descreva a mudança. Siga o padrão de mensagens do repositório. Se não houver um, use mensagens em inglês como `feat: add dynamic vector and linked lists` e `feat: implement FIFO batch processing`.\
4\. Envie o commit ao repositório remoto com `git push`. Configure o upstream no primeiro push da branch, se necessário.\
5\. Confirme que o commit chegou à branch remota e registre seu hash, a branch, os requisitos atendidos e os testes executados.\
\
Divida etapas grandes em incrementos testáveis. Se um teste falhar, diagnostique, corrija e repita a verificação antes de publicar o incremento. Se o push falhar, identifique a causa e tente resolvê-la preservando o histórico e as mudanças da equipe. Se faltar uma URL, credencial ou permissão, mantenha o commit local, informe o bloqueio e identifique os commits pendentes de envio. Siga as regras de proteção das branches e evite `force push`.\
\
## Ordem de implementação\
\
1\. Prepare o build, a CLI inicial, o README.md, a documentação de arquitetura e o AI_LOG.md. Registre este prompt no AI_LOG.md.\
2\. Implemente em C o vetor dinâmico e as listas simplesmente encadeada, duplamente encadeada e circular. Garanta que os recursos sejam liberados e que os encadeamentos permaneçam válidos.\
3\. Implemente Insertion Sort e Merge Sort nas quatro estruturas. Nas listas, ordene religando os nós. Teste as oito combinações com entradas vazias, unitárias, ordenadas, inversas, com duplicatas e com números negativos. Verifique a preservação dos elementos e os invariantes.\
4\. Implemente o benchmark comparativo e a fila FIFO para testes em lote. Use entradas equivalentes e reproduzíveis. Meça tempo, memória e comparações conforme o plan.md e verifique a ordem de execução da fila.\
5\. Implemente o modo passo a passo com pilha em C para Desfazer. Exporte em JSON os eventos produzidos pelo algoritmo e implemente o visualizador em HTML, CSS e JavaScript. Teste a reversão dos eventos e confira se a reprodução no navegador termina na mesma sequência produzida pelo executável C.\
6\. Execute os testes de integração e as verificações de memória disponíveis. Atualize a documentação com os comandos e os resultados reais. Escreva o README.md, os comentários e os nomes de variáveis e funções em inglês. Mantenha o AI_LOG.md atualizado com os prompts relevantes, as adaptações e as correções realizadas.\
\
Priorize RF-01 a RF-07 e RNF-01 a RNF-04. A tabela hash (RF-08) é o extra previsto no plano e pode ser implementada após os requisitos obrigatórios. Para detalhes de implementação que não estejam definidos, adote decisões reversíveis, documente-as e prossiga. Use código legível que a equipe consiga explicar na arguição.\
\
## Entrega\
\
Ao concluir, informe a branch remota e os commits publicados por incremento. Apresente o status de cada requisito com a respectiva evidência. Inclua os comandos para compilar, rodar os testes, executar um benchmark em lote e carregar no visualizador um JSON gerado pelo executável C. Indique os arquivos e funções que a equipe deve inspecionar para depurar as ordenações, a fila e o Desfazer. Identifique as verificações que ainda dependem da equipe.
````

### Base (RNF-01, RNF-02, RNF-03)

Codex added a GNU Make build, the C11 CLI, the README, and the architecture document. Only the plan was present initially. GNU Make was selected after finding GCC and mingw32-make on Windows. Verified with a strict GCC build and the CLI smoke test.

### Structures (RF-01, RF-02)

Codex implemented vector capacity growth and three list layouts in `src/structures/data.c`. A failed realloc leaves the original pointer and capacity intact. Tests validated all four layouts over 100 insertions, growth, item identity, closure, and destruction using `mingw32-make test CFLAGS="-O2 -Werror"`.

### Sorting (RF-03)

Codex added stable insertion and merge sorts in `src/sorting/sort.c`. The list implementations relink original nodes. The matrix verifies all eight combinations across six input classes, including stable identity, unchanged node addresses, and list invariants. Verification uses `mingw32-make test CFLAGS="-O2 -Werror"`.

### Benchmark and batch (RF-04, RF-06)

Codex implemented reproducible input generation, monotonic timing, memory estimates, reference validation, and the FIFO queue in src/benchmark and src/structures/queue.c. The C test checks eight comparison tasks and a three-task batch with an invalid middle record. The sample batch uses identical configurations across all eight combinations.

### Trace and viewer (RF-05, RF-07)

Codex instrumented the real sort operations, wrote the versioned JSON contract, and implemented the C undo stack and a static local viewer. The sorting core emits a logical move for an insertion or a merge selection from the right half. No extra swap events were added. The C and JavaScript checks advance and undo comparisons and moves, verify empty and single-item inputs, and compare replay with the actual C output for all eight combinations.
Verification: strict GCC C tests, Node integration across 24 generated traces, and headless Chrome for all eight combinations. Chrome also checked highlight changes, move undo, autoplay, empty input, malformed JSON, and unsupported schema versions.

### Integration and allocation failures (RF-01, RF-06, RNF-04)

Codex tested allocation failures without changing the production allocator. The test build intercepts allocation calls in vector growth, list append, merge scratch, trace construction, history, and the FIFO. It verifies that owned blocks return to zero after cleanup.

The clean build exposed a Make recipe that assumed cmd.exe on Windows. Codex replaced the conditional command with a mkdir recipe supported by the selected shell. GCC's analyzer also identified a possible null tail in the unspecialized list-restoration helper. Codex guarded circular closure when there is no tail. The allocator test exposed out-of-order reporting on a failed enqueue. The batch now drains older queued work before reporting the failed task and continues reading later tasks.

Verification passed in a clean source copy with strict GCC, Node.js, and headless Chrome. GCC -fanalyzer and the five C test executables under Application Verifier Heaps also passed. The GCC and Visual Studio sanitizer link attempts could not find their runtime libraries. The validation report records the environment, actual benchmark results, and the remaining team review.
