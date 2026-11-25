# Componentes e implantação

## Visão de componentes

```mermaid
flowchart LR
    subgraph NAV["Navegador (aplicação Web React 19)"]
        direction TB
        TOT["Totem<br/>/totem"]
        PAI["Painel<br/>/painel"]
        ATE["Atendente<br/>/atendente"]
        GES["Gestor<br/>/gestor/*"]
        SVC["services/api.js + http.js<br/>(token, timeout, erros)"]
        HK["hooks: usePolling, useVozChamada"]
        TOT --> SVC
        PAI --> SVC
        ATE --> SVC
        GES --> SVC
        PAI --> HK
        TOT --> HK
        ATE --> HK
    end

    subgraph SRV["Servidor (Node.js 22 + Express)"]
        direction TB
        MW["Middlewares<br/>helmet, CORS, rate limit,<br/>auth JWT, validação (zod), erros"]
        RT["Rotas → Controllers"]
        SV["Serviços<br/>senha, atendimento, painel,<br/>auth, cadastro, relatório, expediente"]
        DM["Domínio puro<br/>prioridade + estados"]
        RP["Repositório<br/>(mysql | memory)"]
        JB["Job do expediente<br/>(descarte às 17h)"]
        MW --> RT --> SV --> DM
        SV --> RP
        JB --> SV
    end

    subgraph DBS["Banco de dados"]
        MY[("MySQL 8.0<br/>usuarios, guiches, senhas,<br/>sequencias_diarias, fila_estado,<br/>eventos_senha")]
    end

    SVC -- "HTTP/JSON (/api)" --> MW
    RP -- "mysql2 (pool)" --> MY
```

## Implantação

```mermaid
flowchart TB
    subgraph LAB["Rede do laboratório"]
        TOTEM["Totem (tela touch)<br/>navegador em quiosque → /totem"]
        TV["TV / telão<br/>navegador → /painel"]
        GUI["PCs dos guichês<br/>navegador → /atendente"]
        GER["PC do gestor<br/>navegador → /gestor/*"]
    end

    subgraph SERV["Servidor de aplicação"]
        PROXY["Proxy reverso com HTTPS (TLS)<br/>serve o frontend estático e encaminha /api"]
        NODE["API Node.js 22 / Express<br/>porta 3000"]
        PROXY --> NODE
    end

    subgraph DADOS["Servidor de dados"]
        MYSQL[("MySQL 8.0")]
        BKP["Backup diário<br/>(mysqldump / volume)"]
        MYSQL --> BKP
    end

    TOTEM --> PROXY
    TV --> PROXY
    GUI --> PROXY
    GER --> PROXY
    NODE --> MYSQL
```

| Elemento | Desenvolvimento | Produção (recomendação) |
|----------|-----------------|--------------------------|
| Frontend | `npm run dev` (Vite, porta 5173, proxy de `/api` para a 3000) | `npm run build` → arquivos estáticos em `frontend/dist` servidos pelo proxy reverso |
| Backend | `npm run dev` | `npm start` sob gerenciador de processos com *restart* automático; `NODE_ENV=production` e `JWT_SECRET` forte |
| Banco | `docker compose up -d` (em `backend/`) | MySQL 8.0 gerenciado ou dedicado, com backup e usuário de aplicação com privilégios mínimos |
| Segurança de transporte | HTTP local | **HTTPS obrigatório** no proxy reverso |

> A implantação em produção **não faz parte** das entregas do projeto; o diagrama descreve a arquitetura-alvo proposta.
