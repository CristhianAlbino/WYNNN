// Variável para armazenar os dados do usuário logado
let usuarioLogado = null;
// Variável para armazenar a lista completa de serviços
let allServices = [];
// Intervalo para o polling de serviços
let servicesPollingInterval = null;
// Intervalo para o polling de mensagens de chat não lidas
let unreadChatPollingInterval = null;


// Função para exibir toast notifications (copiada de outras telas)
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error("[CATALOGO JS] Toast container não encontrado!");
        return;
    }

    const toastElement = document.createElement('div');
    toastElement.classList.add('toast');
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    toastElement.setAttribute('data-delay', '5000');

    toastElement.innerHTML = `
        <div class="toast-header ${type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-info text-white'}">
            <strong class="mr-auto">${type === 'success' ? 'Sucesso' : type === 'danger' ? 'Erro' : 'Informação'}</strong>
            <small>Agora</small>
            <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toastElement);
    $(toastElement).toast('show');
    $(toastElement).on('hidden.bs.toast', function () {
        $(this).remove();
    });
}


// Função para carregar o perfil do usuário logado
async function carregarPerfilUsuario() {
    const token = localStorage.getItem('token');
    const usuarioCache = localStorage.getItem('usuario'); // Chave correta para usuário cliente

    // Se não houver token ou cache, redireciona imediatamente
    if (!token || !usuarioCache) {
        console.warn("[CATALOGO JS] Usuário não autenticado ou cache vazio. Redirecionando para login do cliente.");
        window.location.href = "login.html"; // Redireciona para a página de login do cliente
        return; // Interrompe a execução da função
    }

    try {
         // Tenta usar o cache primeiro para preencher nome e foto rapidamente
         usuarioLogado = JSON.parse(usuarioCache);
         const nomeSpan = document.getElementById("user-name");
         const userProfilePicImg = document.getElementById("user-profile-pic");

         if (nomeSpan && usuarioLogado?.nome) {
             nomeSpan.textContent = usuarioLogado.nome;
         }
          if (userProfilePicImg && usuarioLogado?.foto_perfil_url) {
             userProfilePicImg.src = usuarioLogado.foto_perfil_url;
              userProfilePicImg.onerror = function() {
                 // Fallback para imagem padrão se a URL da foto falhar
                 this.onerror = null; // Evita loop infinito de erro
                 this.src = "vendors/images/photo1.jpg"; // Imagem padrão para cliente
             };
         } else if (userProfilePicImg) {
              // Se não houver foto no cache, usa a imagem padrão
              userProfilePicImg.src = "vendors/images/photo1.jpg"; // Imagem padrão para cliente
         }


        // Chamada ao backend para validar o token e obter dados completos e atualizados
         console.log("[CATALOGO JS] Verificando token e buscando perfil no backend...");
         // --- URL ATUALIZADA PARA O BACKEND NO RENDER ---
         const res = await fetch('https://wyn-backend.onrender.com/perfil', {
             headers: { 'Authorization': 'Bearer ' + token }
         });

         const resClone = res.clone(); // Clonar para ler o body se der erro de JSON

         if (!res.ok) {
             // Se o backend retornar 401 ou 403, o token é inválido ou expirado
             if (res.status === 401 || res.status === 403) {
                 console.error("[CATALOGO JS] Token inválido ou expirado. Redirecionando para login do cliente.");
                 showToast("Sua sessão expirou. Por favor, faça login novamente.", 'danger');
                 localStorage.removeItem('token'); // Limpa token inválido
                 localStorage.removeItem('usuario'); // Limpa cache
                 setTimeout(() => { window.location.href = "login.html"; }, 3000); // Redireciona
                 return; // Interrompe a execução
             }
              // Para outros erros HTTP, loga e lança exceção
              const errorText = await resClone.text();
              console.error("[CATALOGO JS] Erro HTTP ao buscar perfil:", res.status, errorText);
              throw new Error(errorText || `Erro HTTP ao buscar perfil: ${res.status}`);
         }

        let data = {};
         try {
             data = await res.json();
             console.log("[CATALOGO JS] Dados de perfil recebidos do backend:", data); // LOG ADICIONADO
         } catch(jsonError) {
             console.error("[CATALOGO JS] Erro ao parsear JSON do perfil:", await resClone.text());
             throw new Error("Resposta de perfil inválida.");
         }


        // Verifique se o perfil retornado é de um usuário cliente ('usuario') E se o ID corresponde
         if (data.tipo !== 'usuario' || !data.usuario?._id || data.usuario._id !== usuarioLogado._id) {
              console.error("[CATALOGO JS] Token válido, mas não corresponde a um usuário cliente ou ID não coincide.");
              showToast("Acesso negado. Esta página é para clientes. Faça login com uma conta de cliente.", 'danger');
              // Redireciona para a página de login geral, pois o token não é de cliente válido
               localStorage.removeItem('token'); // Limpa token incorreto
               localStorage.removeItem('usuario'); // Limpa cache
               setTimeout(() => { window.location.href = "login.html"; }, 3000);
              return; // Interrompe a execução
         }

         // Atualiza a variável global com os dados completos e validados do usuário
         usuarioLogado = data.usuario;
         console.log("[CATALOGO JS] Variável usuarioLogado atualizada:", usuarioLogado); // LOG ADICIONADO


        // Atualiza o nome e foto na interface com os dados validados do backend
        if (usuarioLogado?.nome && nomeSpan) {
            nomeSpan.textContent = usuarioLogado.nome;
             console.log("[CATALOGO JS] Nome do usuário atualizado na UI:", usuarioLogado.nome); // LOG ADICIONADO
        }
         if (userProfilePicImg && usuarioLogado?.foto_perfil_url) {
             userProfilePicImg.src = usuarioLogado.foto_perfil_url;
              userProfilePicImg.onerror = function() {
                 this.onerror = null;
                 this.src = "vendors/images/photo1.jpg";
                 console.warn("[CATALOGO JS] Erro ao carregar foto de perfil, usando padrão."); // LOG ADICIONADO
             };
              console.log("[CATALOGO JS] Foto de perfil do usuário atualizada na UI:", usuarioLogado.foto_perfil_url); // LOG ADICIONADO
         } else if (userProfilePicImg) {
              userProfilePicImg.src = "vendors/images/photo1.jpg";
               console.log("[CATALOGO JS] Sem foto de perfil no backend, usando padrão."); // LOG ADICIONADO
         }


        console.log("[CATALOGO JS] Perfil do usuário (cliente) carregado e validado com sucesso.");

        // --- CHAMA A FUNÇÃO PARA CARREGAR O CATÁLOGO SOMENTE AQUI ---
        carregarServicosCatalogo();
        iniciarPollingServicos(); // Inicia o polling para atualizações
        carregarContadorMensagensNaoLidas(); // Carrega contador de mensagens
        iniciarPollingMensagensNaoLidas(); // Inicia polling para mensagens


    } catch (err) {
        console.error('[CATALOGO JS] Erro ao carregar perfil do usuário ou validar sessão:', err);
         // Se ocorreu um erro na chamada fetch ou no processamento da resposta
         showToast('Erro ao carregar informações do usuário. Por favor, faça login novamente.', 'danger');
         localStorage.removeItem('token'); // Limpa token em caso de erro
         localStorage.removeItem('usuario'); // Limpa cache em caso de erro
         setTimeout(() => { window.location.href = "login.html"; }, 3000); // Redireciona para login do cliente
    }
}

// Função de Logout
document.getElementById('logout-link').addEventListener('click', (e) => {
     e.preventDefault();
     localStorage.removeItem('token');
     localStorage.removeItem('usuario'); // Limpa também o cache do usuário
     localStorage.removeItem('userId'); // Remover também o userId (se estiver usando em algum lugar)
     pararPollingServicos(); // Para o polling de serviços
     pararPollingMensagensNaoLidas(); // Para o polling de mensagens
     window.location.href = 'login.html'; // Redireciona para a página de login do cliente
});


// Função para carregar o contador de mensagens não lidas (copiada do dashboard do prestador e adaptada)
async function carregarContadorMensagensNaoLidas() {
     const token = localStorage.getItem("token");
     const unreadCountElementSidebar = document.getElementById("unread-chat-count-sidebar");
     // const notificationCountElement = document.getElementById("notification-count"); // Contador no sino - não existe nesta página

     if (!token) {
         if (unreadCountElementSidebar) unreadCountElementSidebar.style.display = 'none';
         // if (notificationCountElement) notificationCountElement.style.display = 'none';
         return;
     }

     try {
         // Assumindo um endpoint no backend para contar mensagens não lidas para o usuário logado
         // --- URL ATUALIZADA PARA O BACKEND NO RENDER ---
         const response = await fetch("https://wyn-backend.onrender.com/api/chat/unread-count", { // Endpoint genérico para contar mensagens não lidas do usuário logado
             headers: { 'Authorization': `Bearer ${token}` }
         });

         if (!response.ok) {
              // Em caso de erro (ex: 401, 403), o middleware de perfil já trata o redirect/toast
             console.error("[CATALOGO JS] Erro ao buscar contagem de mensagens não lidas (cliente):", response.status);
             if (unreadCountElementSidebar) unreadCountElementSidebar.style.display = 'none';
             // if (notificationCountElement) notificationCountElement.style.display = 'none';
             return;
         }

         const data = await response.json();
         const unreadCount = data.total || 0;

         // Atualiza o contador na sidebar (se o elemento existir)
         if (unreadCountElementSidebar) {
             if (unreadCount > 0) {
                 unreadCountElementSidebar.textContent = unreadCount;
                 unreadCountElementSidebar.style.display = 'inline';
             } else {
                 unreadCountElementSidebar.style.display = 'none';
             }
         }

         // Atualiza o contador no sino (se o elemento existir) - não existe nesta página
          // if (notificationCountElement) {
          //     if (unreadCount > 0) {
          //          notificationCountElement.textContent = unreadCount; // Ou some com outras contagens de notificações futuras
          //          notificationCountElement.style.display = 'inline';
          //     } else {
          //          notificationCountElement.style.display = 'none';
          //     }
          // }


     } catch (error) {
         console.error("[CATALOGO JS] Erro ao carregar contagem de mensagens não lidas (cliente):", error);
         if (unreadCountElementSidebar) unreadCountElementSidebar.style.display = 'none';
         // if (notificationCountElement) notificationCountElement.style.display = 'none';
     }
}

 // Função para iniciar o polling de mensagens não lidas (a cada 30 segundos) - copiada e adaptada
 // let unreadChatPollingInterval = null; // REMOVIDA A DECLARAÇÃO DUPLICADA AQUI
 function iniciarPollingMensagensNaoLidas() {
     // Limpa qualquer intervalo existente para evitar duplicação
     if (unreadChatPollingInterval) {
         clearInterval(unreadChatPollingInterval);
     }

     // Inicia o polling
     unreadChatPollingInterval = setInterval(() => {
         console.log("[CATALOGO JS] Verificando mensagens não lidas (cliente)...");
         carregarContadorMensagensNaoLidas(); // Chama a função para atualizar a contagem
     }, 30000); // A cada 30 segundos

     console.log("[CATALOGO JS] Polling de mensagens não lidas (cliente) iniciado.");

     // Opcional: Parar o polling quando o usuário sair da página ou fizer logout (já adicionado no logout e beforeunload)
 }

 // Função para parar o polling de mensagens não lidas (copiada e adaptada)
 function pararPollingMensagensNaoLidas() {
     if (unreadChatPollingInterval) {
         clearInterval(unreadChatPollingInterval);
         unreadChatPollingInterval = null;
         console.log("[CATALOGO JS] Polling de mensagens não lidas parado.");
     }
 }


// Função para carregar os serviços do catálogo do backend
async function carregarServicosCatalogo() {
    const loading = document.getElementById("services-loading");
    const feedback = document.getElementById("services-feedback");
    const empty = document.getElementById("services-empty");
    const serviceListDiv = document.getElementById("service-list");
    const token = localStorage.getItem("token");


    loading.style.display = "block";
    feedback.style.display = "none";
    empty.style.display = "none";
    serviceListDiv.innerHTML = ""; // Limpa a lista atual

     // A verificação de token já é feita em carregarPerfilUsuario,
     // mas é bom ter uma redundância aqui caso esta função seja chamada diretamente.
     if (!token) {
          feedback.textContent = "Autenticação necessária para carregar o catálogo.";
          feedback.style.display = "block";
          loading.style.display = "none";
          console.warn("[CATALOGO JS] carregarServicosCatalogo: Token não encontrado.");
          return;
     }

    console.log("[CATALOGO JS] Buscando serviços do catálogo no backend...");
    try {
        // --- CHAMA A ROTA PARA O CATÁLOGO ---
        // --- URL ATUALIZADA PARA O BACKEND NO RENDER ---
        const response = await fetch("https://wyn-backend.onrender.com/servicos-catalogo", { // <-- Rota para o catálogo
             headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CATALOGO JS] Resposta do backend recebida:", response.status);

        if (!response.ok) {
             // Se o backend retornar 401 ou 403, o middleware de perfil já trata o redirect/toast
             // Para outros erros, exibe uma mensagem genérica
             const errorText = await response.text();
             console.error("[CATALOGO JS] Erro HTTP ao buscar serviços do catálogo:", response.status, errorText);
             throw new Error(errorText || `Erro HTTP ao buscar serviços do catálogo: ${response.status}`);
        }

        const servicos = await response.json();
        console.log("[CATALOGO JS] Serviços do catálogo carregados:", servicos);

        allServices = servicos; // Armazena a lista completa

        // Popula o catálogo com os serviços carregados
        populateCatalog(allServices);


    } catch (error) {
        console.error("[CATALOGO JS] Erro ao carregar serviços do catálogo:", error);
        feedback.textContent = `Erro ao carregar serviços: ${error.message || 'Verifique a conexão com o servidor.'}`;
        feedback.style.display = "block";
        empty.style.display = "none";
    } finally {
        loading.style.display = "none";
    }
}

// Função para popular a lista de serviços na UI
function populateCatalog(servicesToDisplay) {
    const serviceListDiv = document.getElementById("service-list");
    const empty = document.getElementById("services-empty");

    serviceListDiv.innerHTML = ""; // Limpa a lista atual

    if (!servicesToDisplay || servicesToDisplay.length === 0) {
        console.log("[CATALOGO JS] Nenhum serviço para exibir. Mostrando mensagem de vazio.");
        empty.style.display = "block";
    } else {
        console.log(`[CATALOGO JS] Exibindo ${servicesToDisplay.length} serviços.`);
        empty.style.display = "none";
        servicesToDisplay.forEach(servico => {
            const serviceCard = document.createElement('div');
            serviceCard.classList.add('col-lg-4', 'col-md-6', 'col-sm-12', 'mb-20');
            // Adiciona data attributes para o ID do serviço oferecido e o ID do prestador
            serviceCard.setAttribute('data-servico-oferecido-id', servico._id);
            // Garante que prestador_id existe antes de tentar acessar _id
            serviceCard.setAttribute('data-prestador-id', servico.prestador_id?._id || '');

            const precoTexto = (servico.faixa_preco_min !== undefined && servico.faixa_preco_max !== undefined)
                                ? `R$ ${servico.faixa_preco_min.toFixed(2).replace('.', ',')} - R$ ${servico.faixa_preco_max.toFixed(2).replace('.', ',')}`
                                : (servico.faixa_preco_min !== undefined ? `A partir de R$ ${servico.faixa_preco_min.toFixed(2).replace('.', ',')}` : 'Preço a combinar');

            serviceCard.innerHTML = `
                <div class="service-card">
                    <img src="${servico.foto_perfil_prestador_url || 'https://placehold.co/600x400/1b00ff/ffffff?text=Servi%C3%A7o'}" alt="${servico.nome || 'Serviço sem Nome'}" onerror="this.onerror=null;this.src='https://placehold.co/600x400/1b00ff/ffffff?text=Servi%C3%A7o';"/>
                    <h5>${servico.nome || 'Serviço sem Nome'}</h5>
                    <p>${servico.descricao || 'Sem descrição.'}</p>
                    <p class="price">Faixa de Preço: ${precoTexto}</p>
                    <div class="provider-info">
                         ${servico.foto_perfil_prestador_url ? `<img src="${servico.foto_perfil_prestador_url}" alt="Foto de Perfil do Prestador" onerror="this.onerror=null;this.src='vendors/images/photo4.jpg';"/>` : `<img src="vendors/images/photo4.jpg" alt="Foto de Perfil Padrão"/>`}
                         <span>Prestador: ${servico.nome_prestador || 'Desconhecido'}</span>
                    </div>
                </div>
            `;
            serviceListDiv.appendChild(serviceCard);
        });

         // Adiciona listener de clique aos novos cards
         addServiceCardListeners();
    }
}

 // Função para adicionar listeners de clique aos cards de serviço
 function addServiceCardListeners() {
     document.querySelectorAll('.service-card').forEach(card => {
         card.addEventListener('click', function() {
             // Pega os IDs dos data attributes
             const servicoOferecidoId = this.closest('.col-lg-4, .col-md-6, .col-sm-12').dataset.servicoOferecidoId;
             const prestadorId = this.closest('.col-lg-4, .col-md-6, .col-sm-12').dataset.prestadorId;

             if (servicoOferecidoId && prestadorId) {
                 // Encontra o objeto de serviço completo na lista allServices
                 const selectedService = allServices.find(s => s._id === servicoOferecidoId);
                 if (selectedService) {
                      openSolicitationModal(selectedService); // Passa o objeto de serviço completo
                 } else {
                      console.error("[CATALOGO JS] Serviço selecionado não encontrado na lista carregada:", servicoOferecidoId);
                       showToast("Não foi possível carregar detalhes do serviço.", 'danger');
                 }
             } else {
                 console.error("[CATALOGO JS] ID do serviço oferecido ou do prestador faltando no card:", this);
                 showToast("Não foi possível solicitar este serviço. Informações incompletas.", 'danger');
             }
         });
     });
 }


// Função para filtrar os serviços exibidos
function filterServices() {
    const searchTerm = document.getElementById("service-search-input").value.toLowerCase();
     const filterProvider = document.getElementById("filter-provider").value.toLowerCase();
     const filterCategory = document.getElementById("filter-category").value.toLowerCase();

    console.log(`[CATALOGO JS] Aplicando filtros: Busca="${searchTerm}", Prestador="${filterProvider}", Categoria="${filterCategory}"`);

    const filteredServices = allServices.filter(service => {
        const serviceName = (service.nome || '').toLowerCase();
        const serviceDescription = (service.descricao || '').toLowerCase(); // Usa descrição do ServicoOferecido
         const providerName = (service.nome_prestador || '').toLowerCase(); // Usa nome_prestador populado
         const categories = (service.categorias?.join(', ') || '').toLowerCase();


        const searchMatch = serviceName.includes(searchTerm) || serviceDescription.includes(searchTerm);
         const providerMatch = providerName.includes(filterProvider);
         const categoryMatch = categories.includes(filterCategory);

        return searchMatch && providerMatch && categoryMatch;
    });
    populateCatalog(filteredServices); // Popula o catálogo com os serviços filtrados
}

// Adiciona listeners para os campos de busca e filtros
document.getElementById('service-search-input').addEventListener('input', filterServices);
document.getElementById('filter-provider').addEventListener('input', filterServices);
document.getElementById('filter-category').addEventListener('input', filterServices);
// O botão "Aplicar Filtros" (apply-filters-btn) no dropdown de busca também pode chamar filterServices se quiser um botão explícito.
// Para simplificar, estou usando 'input' nos campos do dropdown por enquanto.


// Função para abrir o modal de solicitação e preencher com os dados do serviço (MODIFICADA)
function openSolicitationModal(servicoOferecido) { // Recebe o objeto ServicoOferecido
     const modalLabel = document.getElementById('solicitationModalLabel');
     const modalServiceName = document.getElementById('modal-service-name');
     const modalServiceDetails = document.getElementById('modal-service-details');
     const solicitacaoServicoOferecidoIdInput = document.getElementById('solicitacao-servico-oferecido-id');
     const solicitacaoPrestadorIdInput = document.getElementById('solicitacao-prestador-id');


     // Limpa campos e preenche com dados do serviço oferecido
     modalServiceName.textContent = servicoOferecido.nome || 'Serviço sem Nome';
     document.getElementById('modal-provider-name').textContent = servicoOferecido.nome_prestador || 'Desconhecido';
     document.getElementById('modal-service-description').textContent = servicoOferecido.descricao || 'Sem descrição detalhada.';
      const precoDetalhes = (servicoOferecido.faixa_preco_min !== undefined && servicoOferecido.faixa_preco_max !== undefined)
                            ? `R$ ${servicoOferecido.faixa_preco_min.toFixed(2).replace('.', ',')} - R$ ${servicoOferecido.faixa_preco_max.toFixed(2).replace('.', ',')}`
                            : (servicoOferecido.faixa_preco_min !== undefined ? `A partir de R$ ${servicoOferecido.faixa_preco_min.toFixed(2).replace('.', ',')}` : 'Preço a combinar');
     document.getElementById('modal-service-price').textContent = precoDetalhes;

     // Armazena os IDs no formulário oculto
     solicitacaoServicoOferecidoIdInput.value = servicoOferecido._id;
     solicitacaoPrestadorIdInput.value = servicoOferecido.prestador_id?._id || ''; // Garante que pega o ID do prestador

     // Limpa campos de input do cliente
     document.getElementById('data-preferencial').value = '';
     document.getElementById('hora-preferencial').value = '';
     document.getElementById('endereco-servico').value = ''; // Pode pré-preencher com endereço do usuário logado se tiver
     document.getElementById('notas-adicionais').value = '';
     document.getElementById('servico-urgente').checked = false;


     $('#solicitationModal').modal('show'); // Usa jQuery do Bootstrap para mostrar o modal

     // Opcional: Preencher endereço padrão do usuário se disponível no perfil
     if (usuarioLogado?.endereco) { // Assumindo que o perfil do usuário logado tem um campo 'endereco'
         document.getElementById('endereco-servico').value = usuarioLogado.endereco;
     }
}

// Função para fechar o modal de solicitação
 function closeSolicitationModal() {
      $('#solicitationModal').modal('hide'); // Usa jQuery do Bootstrap para fechar o modal
 }


// Listener para o formulário de solicitação de serviço dentro do modal (MODIFICADA)
document.getElementById("solicitation-form").addEventListener("submit", async (event) => {
     event.preventDefault();

     const form = event.target;
     const submitButton = document.getElementById("submit-btn");
     submitButton.disabled = true;
     submitButton.innerHTML = "Enviando..."; // Mudar texto do botão

     const token = localStorage.getItem("token");
     const userId = usuarioLogado?._id; // Pega o ID do usuário logado

     if (!token || !userId) {
          showToast("Erro: Usuário não autenticado.", 'danger');
          submitButton.disabled = false;
          submitButton.textContent = "Enviar Solicitação";
          console.error("[CATALOGO JS] Tentativa de enviar solicitação sem token ou userId.");
          return;
     }

     // Pega os IDs dos campos ocultos
     const servicoOferecidoId = document.getElementById("solicitacao-servico-oferecido-id").value;
     const prestadorId = document.getElementById("solicitacao-prestador-id").value;

     const dataPreferencial = document.getElementById("data-preferencial").value;
     const horaPreferencial = document.getElementById("hora-preferencial").value;
     const enderecoServico = document.getElementById("endereco-servico").value;
     const notasAdicionais = document.getElementById("notas-adicionais").value;
     const urgente = document.getElementById("servico-urgente").checked;

      // Validação básica
     if (!servicoOferecidoId || !prestadorId || !dataPreferencial || !enderecoServico) {
          showToast("Por favor, preencha todos os campos obrigatórios do formulário.", 'danger');
          submitButton.disabled = false;
          submitButton.textContent = "Enviar Solicitação";
           console.warn("[CATALOGO JS] Campos obrigatórios da solicitação não preenchidos.");
          return;
     }


     const solicitationData = {
         servico_oferecido_id: servicoOferecidoId, // Envia o ID do serviço oferecido
         prestador_id: prestadorId, // Envia o ID do prestador
         data_servico_preferencial: dataPreferencial,
         hora_servico_preferencial: horaPreferencial || undefined,
         endereco_servico: enderecoServico,
         notas_adicionais: notasAdicionais,
         urgente: urgente
         // cliente_id, nome_cliente, email_cliente, telefone_cliente, tipo_servico, descricao_servico, etc.
         // serão preenchidos no backend usando o token e o servico_oferecido_id
     };

     console.log("[CATALOGO JS] Enviando solicitação:", solicitationData);

     try {
         // --- URL ATUALIZADA PARA O BACKEND NO RENDER ---
         const response = await fetch("https://wyn-backend.onrender.com/solicitar-servico", {
             method: "POST",
             headers: {
                 "Content-Type": "application/json",
                 'Authorization': `Bearer ${token}`
             },
             body: JSON.stringify(solicitationData),
         });

        console.log("[CATALOGO JS] Resposta do backend para solicitação:", response.status);

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                const errorText = await response.text();
                console.error("[CATALOGO JS] Erro ao parsear JSON da resposta de solicitação:", jsonError, "Resposta do servidor:", errorText);
                 if (!response.ok) {
                     throw new Error(errorText || `Erro HTTP: ${response.status}`);
                 }
                throw new Error("Resposta do servidor inválida.");
            }


         if (!response.ok) {
              showToast(result.message || `Erro ao enviar solicitação.`, 'danger');
              console.error("[CATALOGO JS] Erro ao enviar solicitação:", result);
         } else {
             showToast(result.message || "Solicitação enviada com sucesso! Aguarde o aceite do prestador.", 'success');
             closeSolicitationModal();

             // Opcional: Redirecionar para a página "Meus Pedidos" após a solicitação
              // setTimeout(() => { window.location.href = "contratos.html"; }, 2000); // Redireciona após 2 segundos
         }

     } catch (error) {
          console.error('[CATALOGO JS] Erro ao enviar solicitação:', error);
          showToast("Erro ao enviar solicitação: " + (error.message || "Verifique sua conexão ou tente novamente."), 'danger');
     } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Enviar Solicitação";
     }
});


// Função para iniciar o polling de serviços (a cada 60 segundos)
function iniciarPollingServicos() {
     if (servicesPollingInterval) {
         clearInterval(servicesPollingInterval);
     }

     servicesPollingInterval = setInterval(() => {
         console.log("[CATALOGO JS] Verificando atualizações no catálogo...");
         carregarServicosCatalogo();
     }, 60000); // A cada 60 segundos (1 minuto)

     console.log("[CATALOGO JS] Polling de serviços do catálogo iniciado.");

     window.addEventListener('beforeunload', pararPollingServicos);
}

// Função para parar o polling de serviços
function pararPollingServicos() {
     if (servicesPollingInterval) {
         clearInterval(servicesPollingInterval);
         servicesPollingInterval = null;
         console.log("[CATALOGO JS] Polling de serviços do catálogo parado.");
     }
}


// Chamar carregarPerfilUsuario ao carregar a página
document.addEventListener("DOMContentLoaded", carregarPerfilUsuario);

// Opcional: Parar polling ao fechar a janela/aba
 window.addEventListener('beforeunload', () => {
     pararPollingServicos();
     pararPollingMensagensNaoLidas();
 });
