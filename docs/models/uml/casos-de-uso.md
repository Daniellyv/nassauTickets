# Diagrama de casos de uso

Descrição textual de cada caso de uso em [docs/requirements/casos-de-uso.md](../../requirements/casos-de-uso.md).

O Mermaid não tem notação nativa de casos de uso; o diagrama usa atores (retângulos) e casos de uso (elipses) ligados por associações. O **Gestor** é um atendente com perfil adicional, portanto herda tudo o que o AA faz.

```mermaid
flowchart LR
    AC([AC<br/>Cliente anônimo])
    AA([AA<br/>Atendente])
    GE([Gestor])
    AS([AS<br/>Agente Sistema])

    subgraph SISTEMA["nassauTickets"]
        direction TB
        UC01((UC-01<br/>Retirar senha))
        UC02((UC-02<br/>Acompanhar painel))
        UC03((UC-03<br/>Entrar no sistema))
        UC04((UC-04<br/>Chamar próxima))
        UC05((UC-05<br/>Chamar novamente))
        UC06((UC-06<br/>Iniciar atendimento))
        UC07((UC-07<br/>Finalizar atendimento))
        UC08((UC-08<br/>Registrar<br/>não comparecimento))
        UC09((UC-09<br/>Encerrar expediente))
        UC10((UC-10<br/>Gerenciar atendentes))
        UC11((UC-11<br/>Gerenciar guichês))
        UC12((UC-12<br/>Consultar relatórios))
        UC13((UC-13<br/>Consultar auditoria))
        UC14((UC-14<br/>Exportar CSV))
    end

    AC --- UC01
    AC --- UC02
    AA --- UC03
    AA --- UC04
    AA --- UC05
    AA --- UC06
    AA --- UC07
    AA --- UC08
    GE --- UC10
    GE --- UC11
    GE --- UC12
    GE --- UC13
    GE -. "é também AA" .-> AA
    AS --- UC09

    UC04 -. "&laquo;include&raquo;" .-> UC03
    UC05 -. "&laquo;extend&raquo;" .-> UC04
    UC08 -. "&laquo;extend&raquo;" .-> UC05
    UC14 -. "&laquo;extend&raquo;" .-> UC12
    UC14 -. "&laquo;extend&raquo;" .-> UC13
    UC02 -. "&laquo;include&raquo;<br/>áudio da chamada" .-> UC04
```

Observações:

- **UC-05** estende **UC-04**: só ocorre depois de uma chamada.
- **UC-08** só é possível depois do UC-05 (duas chamadas feitas).
- O painel (UC-02) mostra o resultado de UC-04 e UC-05; a relação é de *consumo* (o painel lê o estado), não de chamada direta.
