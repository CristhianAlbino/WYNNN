document.addEventListener("DOMContentLoaded", function() {
    console.log("DOMContentLoaded: Página totalmente carregada e parseada.");

    // --- Configuração da URL Base da API ---
    // Certifique-se de que esta URL corresponde à URL do seu backend (onde o index.js está rodando)
    const API_BASE_URL = 'http://localhost:3000'; // Ou a URL do seu deploy (ex: https://your-backend-app.com)
    // --- Fim Configuração da URL Base da API ---


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
        console.warn("Elemento #theme-switcher-icon não encontrado. A funcionalidade de alternar tema pode não funcionar.");
    }

    // --- Lógica do Chatbot ---
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const loadingIndicator = document.getElementById('loading-indicator');

    let chatHistory = []; // Histórico do chat para enviar à API

    function addMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Rola para a última mensagem
    }

    async function sendMessageToAI() {
        const userMessage = userInput.value.trim();
        if (userMessage === '') return;

        addMessage('user', userMessage);
        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        userInput.value = ''; // Limpa o input

        loadingIndicator.classList.remove('hidden'); // Mostra o indicador de carregamento
        sendButton.disabled = true; // Desabilita o botão de enviar

        try {
            // CORREÇÃO AQUI: Usando a variável API_BASE_URL para a chamada fetch
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Adiciona o token de autenticação
                },
                body: JSON.stringify({ chatHistory })
            });

            const result = await response.json();

            if (response.ok) { // Verifica se a resposta do backend foi bem-sucedida
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
