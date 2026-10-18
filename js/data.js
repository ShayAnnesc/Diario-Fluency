/* Conteúdo do curso. Cada módulo guarda as próprias unidades; os próximos entram em MODULES com o mesmo formato. */
const TYPES = { CP: "Comprehension Practice", PH: "Pronunciation Hacks", G1: "Grammar Hacks · Part I", G2: "Grammar Hacks · Part II", IT: "Immersion Time", VR: "Vocab Rocket", V1: "Vocab Rocket · Part I", V2: "Vocab Rocket · Part II" };
// Unidades do Basic (fonte: Basic.pdf) — [título, tipo, minutos, atividades, resumo]
const BASIC_UNITS = [
  { t: "Música e emoções", l: [
    ["Listening to a Scene About Music and Emotions", "CP", 30, 3, "Cena musical de Brooklyn Nine-Nine com expressões emocionais."],
    ["Using Common Contractions in Spoken English", "PH", 30, 3, "I'm, you're, that's, what're e formas regionais como y'all're."],
    ["Making Simple Present Questions with Do", "G1", 30, 3, "Perguntas no presente com do: Do you like…?"],
    ["Asking Questions with Wh-Words", "G2", 30, 3, "What, where, who, when, why, how para buscar informações."],
    ["Using Informal Goodbyes in English", "IT", 20, 3, "Despedidas informais e expressões idiomáticas."],
    ["Talking About Professions and Family Members", "V1", 40, 3, "Apresentar-se, profissão, família; verbos be, like, study."],
    ["Describing Your Home and Furniture", "V2", 40, 3, "Moradia, cômodos e objetos; verbos live, have, need."]] },
  { t: "Reality shows e hábitos", l: [
    ["Listening to a Scene from “The Circle”", "CP", 40, 5, "Participantes do reality The Circle falando de si."],
    ["Using Simple Present in Affirmative and Negative Sentences", "G1", 40, 3, "Hábitos no presente e negativas com don't e doesn't."],
    ["Making Questions with Does and WH-Words", "G2", 40, 3, "Perguntas com does e where, what, why, when."],
    ["Expressing Gratitude in Different Ways", "IT", 30, 3, "Formas formais, informais e expressivas de agradecer."],
    ["Pronouncing the Schwa Sound", "PH", 40, 3, "O som /ə/ em bottle, uncle, about."],
    ["Using Vocabulary for Daily Routines", "VR", 40, 3, "Rotina, refeições, horários e atividades do dia."]] },
  { t: "Pets", l: [
    ["Listening Practice: Talking About Pets", "CP", 40, 5, "Cena de Pets: A Vida Secreta dos Bichos."],
    ["Using Verb To Be in Affirmative and Negative Sentences", "G1", 40, 3, "Am, is, are em afirmativas, negativas e perguntas."],
    ["Describing Current Actions with Present Continuous", "G2", 45, 3, "am/is/are + verbo-ing para ações acontecendo agora."],
    ["Responding to Thank You in Natural Ways", "IT", 30, 3, "No problem, Sure, Anytime e outros “de nada”."],
    ["Pronouncing the TH Sound in English", "PH", 40, 3, "Os sons /θ/ e /ð/ em think, this, bath, breathe."],
    ["Talking About Pet Care and Daily Actions", "VR", 40, 3, "Verbos para cuidar de pets: dar banho, passear, brincar."]] },
  { t: "Redes sociais", l: [
    ["Listening to a Scene About Social Media and Influence", "CP", 40, 5, "Cena de Emily in Paris sobre seguidores e conteúdo."],
    ["Using Present Continuous for Future Plans", "G1", 40, 3, "Present Continuous para planos com horários e datas."],
    ["Using Verbs with Gerunds and Infinitives", "G2", 40, 3, "Verbos + -ing ou to + verbo: enjoy talking, learn to cook."],
    ["Clarifying and Asking for Help in Conversations", "IT", 30, 3, "Pedir repetição e esclarecer dúvidas na conversa."],
    ["Practicing Linking Sounds in English", "PH", 40, 3, "Ligações entre palavras em frases naturais."],
    ["Talking About Clothes and Dress Codes", "VR", 40, 3, "Roupas, acessórios, estilos e ocasiões."]] },
  { t: "Realidade virtual", l: [
    ["Listening to a Scene About Virtual Reality", "CP", 40, 5, "Trecho de Ready Player One: realidade e escapismo."],
    ["Using Collocations with Get, Have and Take", "G1", 40, 3, "Combinações naturais com get, have e take."],
    ["Using Possessive Adjectives and Pronouns", "G2", 40, 3, "my/mine, your/yours, their/theirs."],
    ["Practicing Basic Questions and Small Talk", "IT", 30, 3, "Perguntas de apresentação e conversa do dia a dia."],
    ["Practicing Reductions in Spoken Questions", "PH", 40, 3, "whadaya, didja, wheredja, howdja."],
    ["Describing Clothes, Fabrics, and Fit", "VR", 40, 3, "Cores, tecidos, tamanhos e verbos de compra."]] },
  { t: "Preconceito e inclusão", l: [
    ["Understanding Prejudice and Inclusion", "CP", 40, 5, "Fala autêntica sobre sotaques, racismo e empatia."],
    ["Making Simple Requests with Can and May", "G1", 40, 3, "Oferecer ajuda e fazer pedidos com can e may."],
    ["Making Polite Requests with Could", "G2", 40, 3, "Could para pedidos educados e habilidades no passado."],
    ["Accepting and Refusing Invitations", "IT", 30, 3, "Convidar, aceitar e recusar com naturalidade."],
    ["Using Common Reductions in English", "PH", 40, 3, "gonna, gotta, lemme, gimme, wanna, Imma."],
    ["Talking About Countries and Nationalities", "VR", 40, 3, "Países, continentes, nacionalidades e origem."]] },
  { t: "Contando histórias", l: [
    ["Describing Changes in a Story", "CP", 50, 5, "Tomb Raider: videogame vs. filme, estruturas do passado."],
    ["Using Regular Verbs in the Past", "G1", 40, 3, "Simple Past com verbos regulares em afirmativas."],
    ["Making Negative Sentences and Questions in the Past", "G2", 40, 3, "did e didn't para perguntas e negativas."],
    ["Expressing Cultural Reactions", "IT", 30, 3, "Adjetivos para comportamentos e diferenças culturais."],
    ["Pronouncing -ED Endings", "PH", 40, 3, "Os três sons da terminação -ed."],
    ["Talking About Hobbies and Free Time", "VR", 40, 3, "Passatempos e o que você faz no tempo livre."]] },
  { t: "Esperanças e expectativas", l: [
    ["Talking About Hopes and Expectations", "CP", 40, 5, "Cena emocionante com hope, metas e superação."],
    ["Using Was and Were in the Past", "G1", 40, 3, "Verbo to be no passado em todas as formas."],
    ["Talking About Irregular Verbs in the Past", "G2", 40, 3, "Verbos irregulares em afirmativas, negativas e perguntas."],
    ["Expressing Likes and Reactions", "IT", 30, 3, "Dizer que gostou e reagir com entusiasmo."],
    ["Pronouncing Reductions in Real Speech", "PH", 40, 3, "kinda, lotta, outta."],
    ["Talking About School and Education", "VR", 40, 3, "Escola, cursos, disciplinas e vida acadêmica."]] },
  { t: "Vida sustentável", l: [
    ["Talking About Sustainable Living", "CP", 40, 5, "Alimentação, sustentabilidade e vida em comunidade."],
    ["Using Will to Talk About the Future", "G1", 40, 3, "will e won't para previsões, promessas e decisões."],
    ["Talking About Future Plans with Going To", "G2", 40, 3, "be going to para planos e intenções."],
    ["Reacting and Congratulating in English", "IT", 30, 3, "Reagir, elogiar e parabenizar com naturalidade."],
    ["Practicing Contractions with n't", "PH", 40, 3, "Contrações com not em vários tempos verbais."],
    ["Talking About Food and Meals", "VR", 40, 3, "Alimentos, refeições e hábitos alimentares."]] },
  { t: "Cenas musicais", l: [
    ["Understanding Lyrics and Music Scenes", "CP", 50, 5, "Cena musical real: expressões e vocabulário de música."],
    ["Using If and When in Real Situations", "G1", 40, 3, "Condicionais 0 e 1 para hábitos e possibilidades."],
    ["Using Phrasal Verbs in Daily Conversations", "G2", 40, 3, "give in, keep on, set up e outros."],
    ["Using Get in Multiple Meanings", "IT", 30, 3, "get para chegada, entendimento, posse e mais."],
    ["Practicing Reductions: and, or & of", "PH", 40, 3, "'n, 'r, 'f, kinda, outta."],
    ["Talking About Music and Instruments", "VR", 40, 3, "Instrumentos, letras, shows e preferências musicais."]] },
  { t: "Tecnologia e design", l: [
    ["Understanding Technology and Design Tricks", "CP", 40, 5, "Redes sociais e técnicas de engajamento."],
    ["Using There Is / There Are for Description", "G1", 40, 3, "there is/are para descrever objetos e lugares."],
    ["Talking About the Past and Future with There Was / There Will Be", "G2", 40, 3, "there was/were/will be."],
    ["Starting Conversations with Icebreaker Questions", "IT", 30, 3, "Perguntas para puxar conversa informal."],
    ["Practicing Reductions like Yousta, Couldja & Hafta", "PH", 40, 3, "used to → yousta, would you → wouldja, have to → hafta."],
    ["Describing People and Things with Adjectives", "VR", 40, 3, "soft, big, sharp, cold, easy, beautiful."]] },
  { t: "Arte e emoção", l: [
    ["Understanding an Emotional Scene About Art", "CP", 40, 5, "Cena sobre Van Gogh: emoção e opinião artística."],
    ["Using Object Pronouns in Sentences", "G1", 40, 3, "me, you, him, her, us, them."],
    ["Using Reflexive Pronouns in Context", "G2", 40, 3, "myself, yourself, themselves."],
    ["Writing Emails in English", "IT", 30, 3, "Iniciar, desenvolver e fechar e-mails formais e informais."],
    ["Pronouncing the 'll Contraction", "PH", 40, 3, "I'll, She'll, They'll."],
    ["Using Similar Verbs Like Do, Make, Say and Tell", "VR", 40, 3, "Diferenciar verbos parecidos com exemplos práticos."]] },
  { t: "IA no dia a dia", l: [
    ["Understanding AI in Daily Conversations", "CP", 40, 5, "Cena de Her: o papel da IA na vida moderna."],
    ["Using Prepositions of Place and Time", "G1", 40, 3, "in, on, at para lugares, eventos e datas."],
    ["Using From, To and For in Real Contexts", "G2", 40, 3, "Diferenciar from, to e for no cotidiano."],
    ["Using Ain't in Informal English", "IT", 30, 3, "ain't em músicas e diálogos informais."],
    ["Pronouncing Short Vowel Sounds", "PH", 40, 3, "Vogais curtas /æ/, /ʌ/, /ɪ/, /ɒ/."],
    ["Talking About Technology and Devices", "VR", 40, 3, "Tecnologia, internet e dispositivos do dia a dia."]] },
  { t: "Hotéis e viagens", l: [
    ["Understanding a Scene About Hotels and Travel", "CP", 40, 5, "Cena de viagem: hotéis, conforto e imprevistos."],
    ["Using Modals Like Would, Should, Must and Might", "G1", 40, 3, "Desejo, conselho, obrigação e possibilidade."],
    ["Talking About Past Habits with Used To and Would", "G2", 40, 3, "Hábitos antigos e mudanças de comportamento."],
    ["Using Exclamations Like Yay, Oops and Yuck", "IT", 30, 3, "Interjeições de surpresa, alegria, dor e nojo."],
    ["Practicing Long Vowel Sounds in English", "PH", 40, 3, "Vogais longas /iː/, /uː/, /oʊ/."],
    ["Talking About Travel and Transportation", "VR", 40, 3, "Turismo, documentos, transportes e hospedagem."]] },
  { t: "Resiliência", l: [
    ["Listening to Real English About Resilience", "CP", 40, 5, "Bear Grylls sobre frio extremo e superação."],
    ["Using the Past Continuous for Background Actions", "G1", 40, 3, "Ações em progresso e simultâneas no passado."],
    ["Using the Second Conditional for Hypothetical Situations", "G2", 40, 3, "If + Past, would/could/might."],
    ["Using Informal Expressions and Reactions in English", "IT", 30, 3, "I'm screwed, You gotta be kidding me, Or else!"],
    ["Practicing English Rhythm and Contractions", "PH", 40, 3, "Ritmo, entonação e she'd, you'd, woulda."],
    ["Talking About Hobbies and Free Time Activities", "VR", 40, 3, "Atividades criativas, esportes leves e lazer em casa."]] }
];

// `lessons` e `min` são a carga oficial de cada módulo; `units` fica vazio até o conteúdo ser cadastrado.
// `prefix` deixa os ids das aulas únicos entre módulos (o Basic usa "" para manter u1l1, u1l2…).
const MODULES = [
  { id: "basic", prefix: "", name: "Basic", lessons: 91, min: 57 * 60 + 45, units: BASIC_UNITS,
    desc: "Falar sobre o passado e planos futuros, descrever experiências, lidar com viagens e conversar sobre o cotidiano.",
    tags: ["Passado e futuro", "Viagens", "Cotidiano"] },
  { id: "intermediate", prefix: "int-", name: "Intermediate", lessons: 110, min: 72 * 60 + 40, units: [],
    desc: "Autonomia para expressar opiniões e narrar histórias, usar phrasal verbs e resolver imprevistos.",
    tags: ["Argumentar", "Comparar", "Produzir em inglês"] },
  { id: "independent", prefix: "ind-", name: "Independent", lessons: 64, min: 42 * 60 + 40, units: [],
    desc: "Falar com naturalidade, argumentar, entender temas complexos e interagir com nativos.",
    tags: ["Debater", "Analisar", "Comunicar com nuance"] }
];
MODULES.forEach(m => m.units.forEach((u, ui) => {
  u.l = u.l.map((x, li) => ({ id: `${m.prefix}u${ui + 1}l${li + 1}`, title: x[0], type: x[1], min: x[2], acts: x[3], desc: x[4] }));
}));
