# Diário do Inglês

App para acompanhar o curso de inglês da Fluency. Ele registra as aulas concluídas, os dias em que você estudou ou não, a previsão de término do módulo Basic e as suas anotações de cada unidade.

## Estrutura

```
index.html          página (login + app)
css/styles.css      visual, com tema claro e escuro
js/config.js        URL e chave do Supabase (você preenche)
js/data.js          conteúdo do curso: cada módulo com as próprias unidades (Basic: 15 unidades, 91 aulas)
js/store.js         leitura e gravação no Supabase
js/app.js           telas, cálculos de ritmo/previsão, calendário e editor de anotações
supabase/schema.sql tabelas e regras de segurança (RLS)
```

Sem configurar o Supabase, o app já funciona e salva tudo **só no navegador** (localStorage). Com o Supabase, os dados ficam na sua conta e aparecem em qualquer aparelho.

## Configurar o Supabase

1. Crie um projeto em <https://supabase.com> (o plano gratuito basta).
2. No painel, abra **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**. Cole as duas em `js/config.js`.
4. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up** (o site não tem cadastro: só entra quem você criar).
5. Crie o seu usuário em **Authentication → Users → Add user → Create new user**:
   - e-mail no formato `usuario@diario.fluency.com` (ex.: `dev@diario.fluency.com`), uma senha e **Auto Confirm User** marcado;
   - no site, você entra digitando só o **usuário** (`dev`) e a senha. O domínio fica em `LOGIN_DOMAIN`, no `js/config.js`.

O primeiro login envia para a sua conta o que estiver salvo no navegador, então nada do que você marcou antes se perde.

### Tabelas

| Tabela       | O que guarda                                          |
|--------------|-------------------------------------------------------|
| `progress`   | uma linha por aula concluída (`u3l2`) e a data        |
| `study_days` | dias marcados à mão como "estudei"                    |
| `unit_notes` | anotações de cada unidade, por módulo (HTML)          |
| `settings`   | planejamento: data de início, tempo por dia e dias da semana |

Todas têm RLS ligado: cada usuário só lê e altera as próprias linhas. A chave `anon` pode ficar no código porque, sem login, ela não acessa nada.

## Rodar no computador

Abrir o `index.html` direto funciona, mas um servidor local é mais confiável para o login:

```bash
node server.js
```

Depois acesse `http://localhost:3000`.

## Publicar no GitHub Pages

Ao mudar algum arquivo de `css/` ou `js/`, aumente o número `?v=` nos links do `index.html` (ex.: `?v=2` → `?v=3`). Isso faz o navegador baixar a versão nova em vez de usar a guardada em cache.

É um site estático, sem passo de build:

1. Suba a pasta para um repositório no GitHub.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`.
3. No Supabase, em **Authentication → URL Configuration**, coloque o endereço do site (`https://<seu-usuario>.github.io/<repositorio>/`) em **Site URL**.

### Para só você ter acesso

A página do GitHub Pages fica pública: qualquer pessoa com o link vê a tela de login e a lista de aulas do curso. **Os seus dados não ficam expostos**, porque progresso, dias e anotações só saem do Supabase para quem está logado na sua conta. Depois de criar a sua conta:

- em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**. Assim ninguém mais consegue criar conta no seu app;
- se preferir que nem a página apareça para outras pessoas, deixe o repositório privado e publique na Vercel ou na Netlify com proteção por senha, ou use o GitHub Pages privado (exige plano pago do GitHub).

## Planejamento, previsão, constância e ritmo

O planejamento (na página **Métricas**) é a base de tudo: data de início, tempo de estudo por dia e os dias da semana em que você estuda.

- **Aulas por semana planejadas:** tempo por semana dividido pela duração média de uma aula do módulo, sempre arredondado para baixo (só conta a aula que cabe no tempo). Ex.: 5 dias × 1h00 = 300 min ÷ 38 min = **7 aulas/semana**.
- **Previsão pelo planejamento:** percorre o calendário dia a dia. Cada dia planejado soma o seu tempo, e cada aula termina quando o tempo acumulado cobre a duração real dela.
- **Previsão pelo ritmo atual:** média de aulas concluídas nas últimas 4 semanas (ou desde o início, se faz menos tempo).
- **Constância:** dias planejados em que você estudou ÷ dias planejados que já passaram. Dia fora do plano sem estudo é folga e não conta como falta; estudar num dia de folga entra como dia extra e soma na sequência.
- **Ritmo:** o que você fez nas últimas 4 semanas (aulas e horas por semana) comparado com o planejado.

## Próximos módulos

Intermediate e Independent aparecem na trilha e na seção de conteúdo, mas bloqueados e sem aulas. Cada um é liberado quando o módulo anterior é concluído. Para cadastrar o conteúdo, preencha o campo `units` do módulo em `js/data.js` no mesmo formato de `BASIC_UNITS`. Os ids das aulas recebem o prefixo do módulo (`int-u1l1`, `ind-u1l1`), então o progresso de cada módulo fica separado.
