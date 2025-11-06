# ApiHLTV

🔥 CS2 Results API – HLTV Scraper e Automação de Resultados

Recentemente desenvolvi uma API completa em Node.js para consultar e disponibilizar informações de partidas CS2 (Counter-Strike 2) diretamente da HLTV, com foco em confiabilidade, automação e caching inteligente.

O sistema foi projetado para funcionar de forma totalmente autônoma, realizando requisições periódicas, normalizando dados brutos e disponibilizando endpoints prontos para uso em integrações, bots e dashboards.

🚀 Objetivo do Projeto

O objetivo principal desta API é fornecer informações atualizadas de partidas de CS2, tanto ao vivo quanto agendadas e finalizadas, com atualização automática e fallback inteligente em caso de falhas na HLTV.

Ela pode ser usada por:

Robôs de notificação (WhatsApp, Discord, Telegram, etc.).

Dashboards de eSports e sites de estatísticas.

Ferramentas internas de análise e monitoramento de torneios.

🧠 Estrutura e Lógica de Funcionamento

O sistema é composto por dois módulos principais:

1️⃣ Servidor Express (server.js)
Responsável por expor os endpoints REST.

Fornece rotas como /api/cs2/all, /live, /upcoming, /results e /refresh.

Mantém um cache em memória atualizado a cada intervalo configurável.

Garante que o sistema continue respondendo rapidamente sem depender de chamadas externas constantes.

2️⃣ Módulo de Scraping HLTV (scrapers/hltv.js)
Realiza as consultas diretamente na HLTV utilizando múltiplas estratégias:

Tentativa direta na API da HLTV — com headers e cookies simulando um navegador real.

Fallback via Proxy público — para manter disponibilidade mesmo se a API oficial estiver bloqueada.

Raspagem via Puppeteer — abrindo o site e extraindo dados do DOM, inclusive resolvendo desafios de Cloudflare se necessário.

Essa abordagem em camadas garante robustez e redundância, evitando falhas mesmo em cenários de bloqueio de IP ou alterações no site da HLTV.

🧩 Tecnologias Utilizadas

Node.js – ambiente principal de execução.

Express – framework HTTP leve para criação de rotas e middleware.

Axios – consumo das APIs e scraping de páginas.

Puppeteer – automação de navegador, usada como fallback para raspagem visual.

dotenv – gerenciamento de variáveis de ambiente e chaves sensíveis.

CORS & Helmet – segurança de requisições e proteção de headers.

Essas dependências foram escolhidas por seu equilíbrio entre velocidade, compatibilidade e segurança.

⚙️ Funcionamento do Cache

A API mantém um cache local em memória que armazena listas de partidas:

Live (ao vivo)

Upcoming (agendadas)

Finished (finalizadas)

O cache é automaticamente atualizado em intervalos definidos (por padrão, a cada 5 minutos).
Isso reduz drasticamente o consumo de requisições externas, evita bloqueios e garante respostas rápidas aos clientes.

Além disso, o cache pode ser atualizado manualmente via o endpoint /api/cs2/refresh.

🔒 Segurança e Estabilidade

O projeto segue boas práticas para garantir segurança e disponibilidade:

Uso de Helmet e CORS configurável para evitar acessos indevidos.

Sistema de rate limit para prevenir abuso por requisições excessivas.

Armazenamento seguro de cookies e sessões em diretórios isolados.

Tolerância a falhas: se uma camada falha (API oficial), outra assume (proxy, scraping).

🧠 Principais Recursos

🔁 Atualização automática de dados em intervalos configuráveis.

🕹️ Fallback triplo (API HLTV → Proxy → Puppeteer).

⚡ Respostas rápidas graças ao sistema de cache local.

🧩 Estrutura modular, fácil de expandir e integrar com outros serviços.

💬 Rotas REST simples e padronizadas, prontas para consumo.

📊 Dados normalizados (times, evento, horário, status, link e placar).

💡 Possíveis Extensões Futuras

Persistência do cache em banco de dados (MongoDB, Firebase, etc.).

Painel web para visualização das partidas e logs de atualização.

Integração com bots de notificação (WhatsApp, Discord, Telegram).

Histórico de partidas armazenado localmente para análises.

Logs estruturados e sistema de métricas para monitoramento.

🧾 Considerações Finais

Esta API foi desenvolvida com foco em automação profissional, tolerância a falhas e escalabilidade.
Ela demonstra o uso avançado de Node.js, Express e automação com Puppeteer, além de boas práticas de segurança e caching.

O projeto pode ser facilmente adaptado para outras fontes de dados e é ideal como base para sistemas de eSports, painéis de resultados e bots de acompanhamento em tempo real.

👨‍💻 Autor

Desenvolvido por Marcos Souza
