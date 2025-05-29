document.addEventListener("DOMContentLoaded", function() {
    console.log("DOMContentLoaded: Página totalmente carregada e parseada.");

    // --- Configuração da URL do Backend ---
    // IMPORTANTE: Substitua 'YOUR_RENDER_BACKEND_URL_HERE' pela URL real do seu backend no Render.
    // Exemplo: const BACKEND_URL = 'https://seu-app-backend.onrender.com';
    const BACKEND_URL = 'https://wyn-backend.onrender.com'; // <--- ATUALIZADO AQUI!

    if (BACKEND_URL === 'YOUR_RENDER_BACKEND_URL_HERE' || !BACKEND_URL) {
        console.error("ERRO: A URL do backend não foi configurada em script.js. Por favor, atualize a constante BACKEND_URL.");
        // Você pode exibir uma mensagem de erro amigável para o usuário aqui, se desejar.
    }

    // --- Lógica da Tela de Carregamento ---
    const loadingTime = 2000; // 2 segundos

    setTimeout(function() {
        console.log("setTimeout: Ocultando tela de carregamento.");
        const loadingScreen = document.getElementById("loading-screen");
        const mainContent = document.getElementById("content");

        if (loadingScreen) {
            loadingScreen.style.transition = 'opacity 0.5s ease-out';
            loadingScreen.style.opacity = '0';

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

    }, loadingTime);

    // --- Lógica de Alternância de Tema ---
    const themeSwitcher = document.getElementById('theme-switcher-icon');
    const body = document.body;
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme && currentTheme !== 'light-mode') { // Verifica se há um tema salvo E se não é explicitamente 'light-mode'
        body.classList.add(currentTheme);
        // Atualiza o ícone com base no tema aplicado
        if (currentTheme === 'dark-mode') {
            themeSwitcher.classList.replace('bx-moon', 'bx-sun');
        }
    } else {
        // Se não houver tema salvo, ou se for 'light-mode', aplica o tema claro por padrão
        body.classList.remove('dark-mode'); // Garante que a classe dark-mode não esteja presente
         themeSwitcher.classList.replace('bx-sun', 'bx-moon'); // Garante que o ícone seja a lua
    }


    // Adiciona listener para o clique no ícone de alternar tema
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
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

    // --- Lógica do Chatbot de IA ---
    const chatToggleBtn = document.getElementById('chat-toggle-button');
    const floatingChatbotContainer = document.getElementById('floating-chatbot-container');
    const closeChatButton = document.getElementById('close-chat-button');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Determina a mensagem de boas-vindas dinâmica
    const now = new Date();
    const hour = now.getHours();
    let greeting;
    if (hour >= 5 && hour < 12) {
        greeting = "Bom dia!";
    } else if (hour >= 12 && hour < 18) {
        greeting = "Boa tarde!";
    } else {
        greeting = "Boa noite!";
    }

    const initialBotMessage = `${greeting} Eu sou a Wynteligence. E estou aqui para o que você precisar!`;

    // Histórico do chat para enviar à API, incluindo a instrução de sistema
    let chatHistory = [
        {
            role: "user",
            parts: [{
                text: `Você é um assistente de IA chamado Wynteligence dedicado à plataforma WYN. Seu principal objetivo é fornecer informações precisas e úteis sobre o funcionamento da WYN, seus serviços, processos de usuário e prestador, e quaisquer outras funcionalidades relevantes. Responda sempre com foco na WYN e seus ecossistema.

1. O que é a WYN?
A WYN é uma plataforma digital inovadora que atua como uma ponte eficiente e segura, conectando clientes que necessitam de uma vasta gama de serviços a profissionais qualificados e verificados.

Nosso Propósito: Simplificar a vida de usuários e prestadores, oferecendo uma solução completa para encontrar e oferecer serviços com agilidade, segurança e garantia de qualidade.

2. Papéis na Plataforma:
Cliente (Usuário): Indivíduo que busca e contrata serviços.

Prestador (Profissional): Indivíduo ou empresa que oferece e executa serviços.

Administrador (Admin): Responsável pela gestão e moderação da plataforma.

3. Processos Internos e Funcionalidades:
3.1. Cadastro (Registro de Novas Contas):

Clientes: Podem se cadastrar fornecendo informações básicas (nome, e-mail, senha).

Prestadores: O cadastro é mais detalhado, exigindo informações de contato, tipos de serviço oferecidos, área de atuação e, crucialmente, passa por um processo de verificação para garantir a qualificação e segurança. Podem incluir foto de perfil.

3.2. Login (Acesso à Plataforma):

Clientes e Prestadores: Acessam suas contas usando e-mail e senha.

Administradores: Possuem uma tela de login separada (login-admin.html) e credenciais específicas para acessar o dashboard administrativo.

3.3. Fazer Pedido/Solicitar Serviço (Fluxo do Cliente):

Busca: O cliente pesquisa por um tipo de serviço (ex: "Eletricista") na página inicial ou na seção de serviços.

Seleção: O cliente pode visualizar profissionais disponíveis e/ou solicitar um serviço específico.

Detalhes da Solicitação: O cliente preenche um formulário com detalhes do serviço desejado (endereço, urgência, notas adicionais, data e hora preferenciais).

Envio: A solicitação é enviada para os prestadores qualificados na área.

Aceite/Recusa do Prestador: Um prestador pode aceitar a solicitação, propondo um valor, ou recusá-la.

3.4. Pagamento (Fluxo do Cliente):

Integração Mercado Pago: Após um prestador aceitar uma solicitação e propor um valor, o cliente é direcionado para uma página de pagamento pendente.

Geração de Link de Pagamento: A plataforma gera um link de pagamento via Mercado Pago.

Status Pendente: O serviço entra em status de "aguardando_pagamento_cliente" ou "aguardando_confirmacao_pagamento" enquanto o pagamento é processado.

Confirmação: Após a confirmação do pagamento pelo Mercado Pago, o status do serviço é atualizado para "aceito_pelo_prestador" ou "em andamento".

3.5. Gerenciamento de Serviços (Fluxo do Prestador):

Dashboard do Prestador: O prestador tem acesso a um dashboard (index.html) que mostra:

Solicitações Pendentes: Novas solicitações de serviço que ele pode aceitar ou recusar.

Meus Serviços Aceitos/Em Andamento: Serviços que ele aceitou e estão aguardando pagamento do cliente ou já estão em andamento.

Histórico de Serviços: Serviços concluídos ou cancelados.

Minhas Avaliações: Feedback recebido dos clientes.

Gerenciar Serviços: Onde o prestador pode adicionar ou editar os tipos de serviços que oferece.

Minha Disponibilidade: Para gerenciar seus horários.

Ações sobre Solicitações: O prestador pode "Aceitar" (propondo um valor) ou "Recusar" uma solicitação pendente.

Conclusão do Serviço: Após a execução, o prestador marca o serviço como "concluido_pelo_prestador".

3.6. Avaliações (Feedback do Cliente):

Após a conclusão de um serviço, o cliente pode avaliar o prestador, dando estrelas e deixando comentários. Isso contribui para a reputação do prestador na plataforma.

3.7. Notificações:

Sininho de Notificações: Clientes e prestadores recebem notificações em um ícone de sino no cabeçalho.

Tipos de Notificações:

Novas solicitações de serviço (para prestadores).

Atualizações de status de serviço (pagamento confirmado, serviço aceito/recusado, concluído).

Novas mensagens de chat.

Novas avaliações recebidas.

Contador: O ícone do sino exibe um contador de notificações não lidas.

Detalhes: O dropdown do sino mostra um resumo da notificação (ex: "Nova solicitação de serviço", "Pagamento confirmado"). Clicar na notificação marca-a como lida e pode redirecionar para a página relevante (ex: detalhes do serviço, sala de chat).

3.8. Perfil do Usuário/Prestador:

Ambos os tipos de usuários podem acessar e atualizar suas informações de perfil, incluindo foto de perfil.

3.9. Chat de Serviços:

A plataforma oferece uma funcionalidade de chat para comunicação direta entre clientes e prestadores sobre os serviços.

4. Categorias de Serviços:
Atualmente Ativas: Eletricista.

Em Breve: Encanador, Pintor, Ar Condicionado, Jardinagem, Pedreiro, Limpeza.

Em Expansão: Outras categorias como Personal Trainer, Aulas de Música, Fotografia, etc. (A IA deve indicar que estas estão em fase de expansão e podem não estar listadas em todas as interfaces como "Em Breve" explícito, mas fazem parte do plano de crescimento).

Lembretes para a IA:

Sempre que perguntado sobre um serviço "Em Breve", mencione que a WYN está trabalhando para disponibilizá-lo e convide o usuário a se cadastrar para receber notificações.

Mantenha um tom profissional, prestativo e claro. E SEMPRE PASSE INFORMAÇÕES RESUMIDAS, diretas e objetivas. evite fazer um textão para o usuário.

Evite jargões técnicos desnecessários, a menos que o usuário solicite.

Se a pergunta for fora do escopo da WYN, informe educadamente que sua função é apenas sobre a plataforma WYN.`
            }]
        },
        {
            role: "model",
            parts: [{
                text: initialBotMessage
            }]
        }
    ];

    // Adiciona a mensagem inicial do bot ao carregar a página
    addMessage('bot', initialBotMessage);

    // Sugestões de Perguntas Frequentes (FAQs)
    const faqs = [
        { question: "O que é a WYN?" },
        { question: "Como me cadastro?" },
        { question: "Quais serviços estão disponíveis?" }
    ];

    function renderFaqButtons() {
        const faqButtonsContainer = document.createElement('div');
        faqButtonsContainer.classList.add('faq-buttons-container');

        faqs.forEach(faq => {
            const button = document.createElement('button');
            button.classList.add('faq-button');
            button.textContent = faq.question;
            button.addEventListener('click', () => {
                userInput.value = faq.question; // Preenche o input com a pergunta
                sendMessageToAI(); // Envia a pergunta
            });
            faqButtonsContainer.appendChild(button);
        });
        chatMessages.appendChild(faqButtonsContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Rola para a última mensagem
    }

    // Renderiza os botões de FAQ após a mensagem inicial
    renderFaqButtons();


    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        const paragraphElement = document.createElement('p');
        paragraphElement.textContent = text;
        messageElement.appendChild(paragraphElement);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Rola para a última mensagem
    }

    async function sendMessageToAI() {
        const message = userInput.value.trim();
        if (message === '') return;

        addMessage('user', message);
        chatHistory.push({
            role: "user",
            parts: [{
                text: message
            }]
        });
        userInput.value = ''; // Limpa o input

        loadingIndicator.classList.remove('hidden'); // Mostra o indicador de carregamento
        sendButton.disabled = true; // Desabilita o botão de enviar

        try {
            // Usa a URL completa do backend
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chatHistory: chatHistory
                })
            });

            const result = await response.json();

            if (response.ok && result.aiResponse) { // Verifica se a resposta do backend foi bem-sucedida
                addMessage('bot', result.aiResponse);
                chatHistory.push({
                    role: "model",
                    parts: [{
                        text: result.aiResponse
                    }]
                });
            } else {
                addMessage('bot', result.message || 'Desculpe, não consegui gerar uma resposta. Tente novamente.');
                console.error('Erro na resposta do backend:', result);
            }
        } catch (error) {
            console.error('Erro ao chamar o backend:', error);
            addMessage('bot', 'Ocorreu um erro ao conectar com a IA. Por favor, tente novamente mais tarde.');
        } finally {
            loadingIndicator.classList.add('hidden'); // Esconde o indicador de carregamento
            sendButton.disabled = false; // Habilita o botão de enviar
        }
    }

    // Event listener para o botão de enviar
    if (sendButton) {
        sendButton.addEventListener('click', sendMessageToAI);
    } else {
        console.warn("Elemento #send-button não encontrado.");
    }

    // Event listener para a tecla Enter no campo de input
    if (userInput) {
        userInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                sendMessageToAI();
            }
        });
    } else {
        console.warn("Elemento #user-input não encontrado.");
    }

    // Lógica para o botão de toggle do chat flutuante
    if (chatToggleBtn && floatingChatbotContainer && closeChatButton) {
        chatToggleBtn.addEventListener('click', () => {
            floatingChatbotContainer.classList.toggle('hidden');
            floatingChatbotContainer.classList.toggle('visible');
            // Rola para a última mensagem quando o chat é aberto
            if (floatingChatbotContainer.classList.contains('visible')) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });

        closeChatButton.addEventListener('click', () => {
            floatingChatbotContainer.classList.add('hidden');
            floatingChatbotContainer.classList.remove('visible');
        });
    } else {
        console.warn("Elementos do chat flutuante não encontrados. Verifique 'chat-toggle-button', 'floating-chatbot-container' ou 'close-chat-button'.");
    }

    // --- Lógica do Carrossel de Imagens na Seção de Prestadores ---
    function startImageSlider() {
        const sliderImages = document.querySelectorAll('.image-slider .slider-image');
        let currentImageIndex = 0;
        const intervalTime = 3000; // Tempo em milissegundos (3 segundos)

        if (sliderImages.length === 0) {
            console.warn("Nenhuma imagem encontrada para o carrossel na seção de prestadores.");
            return;
        }

        // Função para mostrar a próxima imagem
        function showNextImage() {
            // Remove a classe 'active' da imagem atual
            sliderImages[currentImageIndex].classList.remove('active');

            // Calcula o índice da próxima imagem
            currentImageIndex = (currentImageIndex + 1) % sliderImages.length;

            // Adiciona a classe 'active' à próxima imagem
            sliderImages[currentImageIndex].classList.add('active');
        }

        // Inicia o intervalo para alternar as imagens
        setInterval(showNextImage, intervalTime);
    }

    // Chama a função para iniciar o carrossel de imagens quando o DOM estiver carregado
    startImageSlider();
});
