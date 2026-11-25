# Diagrama de classes

## Modelo de domínio

Entidades persistidas (espelham o [MER](../../mer/mer.md)) e os tipos de domínio.

```mermaid
classDiagram
    direction LR

    class Senha {
        +id: number
        +numero: string  «YYMMDD-PPSQ»
        +tipo: TipoSenha
        +sequencia: number
        +dataEmissao: Date
        +estado: EstadoSenha
        +emitidaEm: DateTime
        +numChamadas: number
        +primeiraChamadaEm: DateTime
        +segundaChamadaEm: DateTime
        +ultimaChamadaEm: DateTime
        +inicioAtendimentoEm: DateTime
        +fimAtendimentoEm: DateTime
    }

    class Usuario {
        +id: number
        +nome: string
        +username: string
        +senhaHash: string
        +perfil: Perfil
        +ativo: boolean
    }

    class Guiche {
        +id: number
        +numero: number
        +ativo: boolean
    }

    class EventoSenha {
        +id: number
        +estadoAnterior: EstadoSenha
        +estadoNovo: EstadoSenha
        +ocorridoEm: DateTime
    }

    class SequenciaDiaria {
        +data: Date
        +tipo: TipoSenha
        +ultimo: number
    }

    class FilaEstado {
        +ultimoTipo: TipoSenha
    }

    class TipoSenha {
        <<enumeration>>
        SP
        SE
        SG
    }
    class EstadoSenha {
        <<enumeration>>
        EMITIDA
        AGUARDANDO
        CHAMADA
        CHAMADA_NOVAMENTE
        EM_ATENDIMENTO
        ATENDIDA
        NAO_COMPARECEU
        DESCARTADA
    }
    class Perfil {
        <<enumeration>>
        ATENDENTE
        GESTOR
    }

    Usuario "1" --> "0..*" Senha : atende
    Guiche "1" --> "0..*" Senha : recebe
    Senha "1" *-- "1..*" EventoSenha : auditoria
    EventoSenha "0..*" --> "0..1" Usuario : autor
    EventoSenha "0..*" --> "0..1" Guiche : guichê
    Senha ..> TipoSenha
    Senha ..> EstadoSenha
    Usuario ..> Perfil
    SequenciaDiaria ..> TipoSenha : contador por dia e tipo
    FilaEstado ..> TipoSenha : última chamada / trava
```

## Camadas do backend

```mermaid
classDiagram
    direction TB

    class Routes {
        <<routes/index.js>>
        +criarRotas()
    }
    class Controllers {
        <<controllers/index.js>>
        +emitirSenha()
        +chamarProxima()
        +relatorioResumo()
    }
    class SenhaService {
        +emitir(tipo)
    }
    class AtendimentoService {
        +chamarProxima(usuario, guicheId)
        +chamarNovamente(usuario, id)
        +iniciar(usuario, id)
        +finalizar(usuario, id)
        +naoCompareceu(usuario, id)
        +atual(usuario)
        +descartarSobras()
    }
    class PainelService {
        +ultimasChamadas()
    }
    class AuthService {
        +login(usuario, senha)
        +autenticarToken(token)
    }
    class CadastroService {
        +criarUsuario()
        +atualizarUsuario()
        +criarGuiche()
    }
    class RelatorioService {
        +resumo(periodo)
        +detalhado(periodo)
        +auditoria(periodo)
    }
    class ExpedienteService {
        +aberto(agora)
        +aposFim(agora)
        +garantirAberto(agora)
    }
    class Prioridade {
        <<domain/prioridade.js>>
        +escolherProximoTipo(ultimo, filas)
    }
    class Estados {
        <<domain/estados.js>>
        +podeTransitar(de, para)
    }
    class Repositorio {
        <<interface>>
        +comTrava(fn)
        +ultimasChamadas()
        +senhasPorPeriodo()
        +buscarUsuario()
    }
    class MysqlRepository
    class MemoryRepository

    Routes --> Controllers
    Controllers --> SenhaService
    Controllers --> AtendimentoService
    Controllers --> PainelService
    Controllers --> AuthService
    Controllers --> CadastroService
    Controllers --> RelatorioService
    SenhaService --> ExpedienteService
    AtendimentoService --> ExpedienteService
    AtendimentoService --> Prioridade
    AtendimentoService --> Estados
    SenhaService --> Repositorio
    AtendimentoService --> Repositorio
    PainelService --> Repositorio
    AuthService --> Repositorio
    CadastroService --> Repositorio
    RelatorioService --> Repositorio
    Repositorio <|.. MysqlRepository
    Repositorio <|.. MemoryRepository
```

O **domínio** (`Prioridade`, `Estados`) é puro: sem I/O, testável isoladamente. Os repositórios têm a mesma interface, o que permite trocar `mysql` por `memory` (`DB_DRIVER`) sem alterar as regras.
