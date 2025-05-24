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
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const loadingIndicator = document.getElementById('loading-indicator');

    let chatHistory = [{
        role: "model",
        parts: [{
            text: "Olá! Como posso ajudar você hoje?"
        }]
    }]; // Inicia com a mensagem do bot

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
});
