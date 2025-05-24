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

    // --- Lógica de Alternância de Tema ---
    const themeSwitcher = document.getElementById('theme-switcher-icon');
    const body = document.body;
    const currentTheme = localStorage.getItem('theme'); // Pega o tema salvo no localStorage

    // Aplica o tema salvo ao carregar a página
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

});
