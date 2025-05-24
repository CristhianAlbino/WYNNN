document.addEventListener("DOMContentLoaded", function() {
    console.log("DOMContentLoaded: Página totalmente carregada e parseada.");

    // --- Lógica da Tela de Carregamento ---
    // Simula o tempo de carregamento (ajuste conforme necessário)
    const loadingTime = 2000; // 2 segundos

    setTimeout(function() {
        console.log("setTimeout: Ocultando tela de carregamento.");
        const loadingScreen = document.getElementById("loading-screen");
        const mainContent = document.getElementById("content");

        if (loadingScreen) {
            // Adiciona uma transição suave para a opacidade antes de ocultar
            loadingScreen.style.transition = 'opacity 0.5s ease-out';
            loadingScreen.style.opacity = '0';

            // Remove o elemento da tela após a transição
            loadingScreen.addEventListener('transitionend', () => {
                loadingScreen.style.display = "none";
                console.log("Tela de carregamento oculta.");
            });

        } else {
            console.warn("Elemento #loading-screen não encontrado.");
        }

        if (mainContent) {
            mainContent.classList.remove("hidden");
            console.log("Conteúdo principal exibido.");
        } else {
            console.warn("Elemento #content não encontrado. O conteúdo principal pode não estar sendo exibido corretamente.");
        }

    }, loadingTime); // Usa a variável loadingTime

    // --- Lógica do Theme Switcher ---
    const themeSwitcher = document.getElementById('theme-switcher-icon');
    const body = document.body;

    // Função para aplicar o tema salvo no localStorage
    function applySavedTheme() {
        const currentTheme = localStorage.getItem('theme');
        // Verifica se há um tema salvo E se não é explicitamente 'light-mode'
        if (currentTheme && currentTheme !== 'light-mode') {
            body.classList.add(currentTheme);
            // Atualiza o ícone com base no tema aplicado
            if (currentTheme === 'dark-mode') {
                if (themeSwitcher) themeSwitcher.classList.replace('bx-moon', 'bx-sun');
            }
        } else {
            // Se não houver tema salvo, ou se for 'light-mode', aplica o tema claro por padrão
            body.classList.remove('dark-mode'); // Garante que a classe dark-mode não esteja presente
            if (themeSwitcher) themeSwitcher.classList.replace('bx-sun', 'bx-moon'); // Garante que o ícone seja a lua
        }
    }

    // Aplica o tema ao carregar a página
    applySavedTheme();

    // Adiciona listener para o clique no ícone de alternar tema
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', (e) => {
            e.preventDefault(); // Previne o comportamento padrão do link
            // Alterna a classe 'dark-mode' no body
            body.classList.toggle('dark-mode');

            // Salva a preferência no localStorage e atualiza o ícone
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark-mode');
                themeSwitcher.classList.replace('bx-moon', 'bx-sun'); // Muda para o sol
            } else {
                localStorage.setItem('theme', 'light-mode'); // Salva como light-mode
                themeSwitcher.classList.replace('bx-sun', 'bx-moon'); // Muda para a lua
            }
        });
    } else {
        console.warn("Elemento #theme-switcher-icon não encontrado.");
    }

    // --- Lógica do Menu Mobile ---
    const menuToggle = document.getElementById('menu-toggle');
    const siteNav = document.querySelector('.site-nav');

    if (menuToggle && siteNav) {
        menuToggle.addEventListener('change', () => {
            if (menuToggle.checked) {
                siteNav.style.maxHeight = siteNav.scrollHeight + "px"; // Expande o menu
            } else {
                siteNav.style.maxHeight = "0"; // Recolhe o menu
            }
        });

        // Fechar menu mobile ao clicar em um link
        document.querySelectorAll('.site-nav ul li a').forEach(item => {
            item.addEventListener('click', () => {
                menuToggle.checked = false; // Desmarca o toggle
                siteNav.style.maxHeight = "0"; // Recolhe o menu
            });
        });
    }

    // --- Lógica do Chatbot FAQ ---
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatbotBox = document.getElementById('chatbot-box');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // Dados do FAQ (perguntas e respostas)
    const faqData = {
        "como-funciona": "A WYN conecta você a profissionais qualificados. Você busca o serviço, compara perfis e orçamentos, e contrata com confiança.",
        "cadastrar-prestador": "Para se cadastrar como prestador, clique no botão 'Seja um Prestador' na seção 'É um Profissional de Serviços?' ou acesse a página de Login/Cadastro.",
        "seguranca": "Sim, a WYN é segura! Verificamos os profissionais e temos um sistema de avaliação robusto para garantir a qualidade e a sua segurança.",
        "custo-servico": "A WYN é gratuita para quem busca serviços. Os valores dos serviços são negociados diretamente com o profissional, sem taxas adicionais da plataforma para o cliente.",
        "contato": "Você pode entrar em contato conosco através do formulário na seção 'Entre em Contato Conosco' ou enviar um e-mail para wyn151518@gmail.com.",
        "falar-humano": "No momento, este é um assistente virtual. Para assuntos que requerem atenção humana, por favor, utilize o formulário de contato ou o e-mail de suporte.",
        "ola": "Olá! Como posso te ajudar?",
        "oi": "Oi! No que posso ser útil?",
        "bom dia": "Bom dia! Como posso te auxiliar hoje?",
        "boa tarde": "Boa tarde! Precisa de alguma informação?",
        "boa noite": "Boa noite! Em que posso ajudar?",
        "obrigado": "De nada! Se precisar de algo mais, é só perguntar.",
        "agradeço": "Disponha! Fico feliz em ajudar.",
        "serviços disponíveis": "Oferecemos uma ampla gama de serviços, incluindo Eletricista, Encanador, Pintor, Ar Condicionado, Jardinagem, Pedreiro, e estamos sempre adicionando mais! Confira a seção 'Categorias Populares'.",
        "como buscar um serviço": "Para buscar um serviço, digite o que você precisa na barra de busca na seção principal (ex: 'Eletricista, Diarista...') e clique em 'Buscar'. Você verá uma lista de profissionais disponíveis.",
        "como avaliar um profissional": "Após a conclusão de um serviço, você receberá uma notificação para avaliar o profissional. Sua avaliação é muito importante para a comunidade WYN e para a segurança de todos!",
        "cancelar serviço": "Para cancelar um serviço, você deve entrar em contato diretamente com o profissional e, se necessário, com nosso suporte através do formulário de contato, informando os detalhes do serviço.",
        "pagamento": "Os pagamentos são feitos diretamente ao profissional após a conclusão do serviço, conforme o que foi acordado entre vocês. A WYN não processa pagamentos, apenas facilita a conexão.",
        "categorias futuras": "Estamos trabalhando para expandir nossas categorias! Em breve teremos Personal Trainer, Aulas de Música, Fotografia e muito mais. Deixe seu e-mail na seção 'Categorias Em Breve' para ser avisado.",
        "admin login": "O login de administrador é restrito. Se você é um administrador, por favor, use o link 'Admin' no cabeçalho para acessar a página de login exclusiva.",
        "problema com profissional": "Se você teve algum problema com um profissional, por favor, entre em contato com nosso suporte através do formulário na seção 'Entre em Contato Conosco', fornecendo o máximo de detalhes possível.",
        "como funciona o agendamento": "Após encontrar o profissional, você poderá entrar em contato para negociar os detalhes e agendar o serviço diretamente com ele.",
        "verificar profissional": "Todos os profissionais na WYN passam por um processo de verificação para garantir a segurança e a qualidade. Além disso, você pode ver as avaliações de outros usuários."
        // Adicione mais perguntas e respostas aqui para expandir o FAQ
    };

    // Função para adicionar uma mensagem ao chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;
        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight; // Rola para a última mensagem
    }

    // Função para exibir as opções de FAQ
    function showFaqOptions() {
        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('message', 'bot-message', 'option-list');
        optionsDiv.innerHTML = `
            <ul>
                <li><a href="#" data-question="como-funciona">1. Como funciona a WYN?</a></li>
                <li><a href="#" data-question="cadastrar-prestador">2. Como me cadastro como prestador?</a></li>
                <li><a href="#" data-question="seguranca">3. A WYN é segura?</a></li>
                <li><a href="#" data-question="custo-servico">4. Quanto custa usar a WYN?</a></li>
                <li><a href="#" data-question="contato">5. Como entro em contato com o suporte?</a></li>
                <li><a href="#" data-question="falar-humano">6. Posso falar com um atendente?</a></li>
                <li><a href="#" data-question="serviços disponíveis">7. Quais serviços estão disponíveis?</a></li>
                <li><a href="#" data-question="como buscar um serviço">8. Como buscar um serviço?</a></li>
                <li><a href="#" data-question="pagamento">9. Como funciona o pagamento?</a></li>
                <li><a href="#" data-question="categorias futuras">10. Quais categorias virão em breve?</a></li>
            </ul>
        `;
        chatbotMessages.appendChild(optionsDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Função para lidar com a entrada do usuário
    function handleUserInput() {
        const message = userInput.value.trim();
        if (message === '') return; // Não envia mensagens vazias

        addMessage(message, 'user');
        userInput.value = ''; // Limpa o input

        // Processa a mensagem do usuário para encontrar uma resposta no FAQ
        const lowerCaseMessage = message.toLowerCase();
        let botResponse = "Desculpe, não consegui entender sua pergunta. Por favor, tente reformular ou escolha uma das opções abaixo:";

        // Tenta encontrar uma correspondência exata ou parcial nas chaves do FAQ
        let foundResponse = false;
        for (const key in faqData) {
            if (lowerCaseMessage.includes(key)) {
                botResponse = faqData[key];
                foundResponse = true;
                break;
            }
        }

        setTimeout(() => {
            addMessage(botResponse, 'bot');
            if (!foundResponse) {
                // Se não encontrou resposta, reexibe as opções
                showFaqOptions();
            }
        }, 500); // Pequeno atraso para simular "digitação" do bot
    }

    // Event listeners para o chatbot
    if (chatbotToggleBtn) {
        chatbotToggleBtn.addEventListener('click', () => {
            chatbotBox.classList.toggle('open');
            if (chatbotBox.classList.contains('open')) {
                // Se o chatbot for aberto, garante que as opções iniciais sejam exibidas
                // e que o scroll esteja no final
                chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            }
        });
    }

    if (chatbotCloseBtn) {
        chatbotCloseBtn.addEventListener('click', () => {
            chatbotBox.classList.remove('open');
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', handleUserInput);
    }

    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUserInput();
            }
        });
    }

    // Adiciona listener para cliques nas opções de FAQ
    chatbotMessages.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.dataset.question) {
            e.preventDefault(); // Previne o comportamento padrão do link
            const questionKey = e.target.dataset.question;
            const questionText = e.target.textContent.substring(e.target.textContent.indexOf('.') + 2); // Pega o texto da pergunta (ex: "Como funciona a WYN?")

            addMessage(questionText, 'user'); // Adiciona a pergunta clicada como mensagem do usuário

            setTimeout(() => {
                const answer = faqData[questionKey] || "Desculpe, não encontrei a resposta para esta pergunta.";
                addMessage(answer, 'bot');
            }, 500);
        }
    });

});
