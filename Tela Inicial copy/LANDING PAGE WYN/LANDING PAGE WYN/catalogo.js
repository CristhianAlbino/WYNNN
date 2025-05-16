// Variável para armazenar os dados do usuário logado
let usuarioLogado = null;
// Variável para armazenar a lista completa de serviços
let allServices = [];

// Lista de serviços com informações detalhadas e URLs de imagem (placeholders)
const services = [
     {
          type: "Troca de Lâmpadas",
          title: "Troca de Lâmpadas",
          description: "Substituição de lâmpadas queimadas ou troca por LED.",
          price: 70.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Troca+L%C3%A2mpadas", // Placeholder mais relevante
          details: "Inclui verificação de soquete, tensão e instalação segura. Ideal para ambientes residenciais ou comerciais."
     },
     {
          type: "Instalação de Tomadas",
          title: "Instalação de Tomadas",
          description: "Instalação ou substituição de tomadas 110V/220V.",
          price: 90.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Instala%C3%A7%C3%A3o+Tomadas", // Placeholder mais relevante
          details: "Verificação da fiação e disjuntores para segurança elétrica. Pode incluir mudança de local e instalação embutida."
     },
     {
          type: "Troca de Disjuntor",
          title: "Troca de Disjuntor",
          description: "Substituição de disjuntores danificados ou obsoletos.",
          price: 180.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Troca+Disjuntor", // Placeholder mais relevante
          details: "Verificação do quadro elétrico e dimensionamento correto. Indicado para prevenir curtos e sobrecargas."
     },
     {
          type: "Instalação de Quadro de Luz",
          title: "Instalação de Quadro de Luz",
          description: "Montagem ou substituição de quadro de distribuição.",
          price: 350.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Quadro+de+Luz", // Placeholder mais relevante
          details: "Ideal para obras ou atualizações de rede elétrica. Inclui organização de circuitos e identificação de disjuntores."
     },
     {
          type: "Reparo em Curto-Circuito",
          title: "Reparo em Curto-Circuito",
          description: "Identificação e correção de falhas elétricas.",
          price: 120.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Curto-Circuito", // Placeholder mais relevante
          details: "Diagnóstico com ferramentas específicas e reparo imediato. Segurança garantida para evitar choques e incêndios."
     },
     {
          type: "Instalação de Ventilador de Teto",
          title: "Instalação de Ventilador de Teto",
          description: "Montagem e fixação de ventiladores com ou sem lustre.",
          price: 220.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Ventilador+Teto", // Placeholder mais relevante
          details: "Inclui instalação elétrica e verificação de suporte adequado. Equilíbrio, teste de funcionamento e ajustes finais inclusos."
     },
     {
          type: "Instalação de Luminárias",
          title: "Instalação de Luminárias",
          description: "Fixação e ligação elétrica de luminárias diversas.",
          price: 130.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Instala%C3%A7%C3%A3o+Lumin%C3%A1rias", // Placeholder
          details: "Para tetos, paredes, trilhos ou spots embutidos. Inclui testes e ajustes de iluminação."
     },
     {
          type: "Troca de Fiação",
          title: "Troca de Fiação",
          description: "Substituição de fiação elétrica antiga ou danificada.",
          price: 280.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Troca+Fia%C3%A7%C3%A3o", // Placeholder
          details: "Segurança, eficiência e atualização da rede elétrica. Ideal para reformas ou imóveis antigos."
     },
     {
          type: "Instalação de DPS e DR",
          title: "Instalação de DPS e DR",
          description: "Proteção contra surtos elétricos e choques.",
          price: 300.00,
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=Instala%C3%A7%C3%A3o+DPS+DR", // Placeholder
          details: "Instalação dos dispositivos no quadro de luz. Previne queima de aparelhos e garante segurança."
     },
     {
          type: "Instalação Elétrica Residencial",
          title: "Instalação Elétrica Residencial",
          description: "Serviço completo de elétrica para nova residência.",
          price: 1.00, // Preço simbólico, o prestador orça
          imageUrl: "https://placehold.co/600x400/1b00ff/ffffff?text=El%C3%A9trica+Residencial", // Placeholder
          details: "Desde o quadro de distribuição até os pontos de uso. Planejamento de circuitos, tomadas, iluminação e padrões."
     }
];

// Elementos do modal de solicitação
const solicitationSection = document.getElementById('solicitation-section');
const closeSolicitationBtn = document.getElementById('close-solicitation');
const solicitationForm = document.getElementById('formSolicitarServico'); // ID do formulário no modal
const modalServiceTitleSpan = document.getElementById('modal-service-title'); // Título no modal
const selectedServiceDescriptionSpan = document.getElementById('selected-service-description'); // Descrição no modal
const selectedServicePriceSpan = document.getElementById('selected-service-price'); // Preço no modal
const serviceTypeInput = document.getElementById('service-type-input'); // Input hidden para tipo
const servicePriceInput = document.getElementById('service-price-input'); // Input hidden para preço
const serviceFullDescriptionInput = document.getElementById('service-full-description-input'); // Input hidden para descrição completa

// Campos do formulário no modal
const nomeClienteInput = document.getElementById('nome_cliente');
const emailClienteInput = document.getElementById('email_cliente');
const telefoneClienteInput = document.getElementById('telefone_cliente');
const enderecoServicoInput = document.getElementById('endereco_servico');
const dataServicoInput = document.getElementById('data_servico_preferencial');
const horaServicoInput = document.getElementById('hora_servico_preferencial');
const notasAdicionaisTextarea = document.getElementById('notas_adicionais');
const urgenteCheckbox = document.getElementById('urgente');
const submitButton = solicitationForm.querySelector('button[type="submit"]');

// Elemento de busca
const serviceSearchInput = document.getElementById('service-search');


// Função para carregar o perfil do usuário
async function carregarPerfilUsuario() {
    const token = localStorage.getItem('token');
    const usuarioCache = localStorage.getItem('usuario');

    if (!token || !usuarioCache) {
        console.warn("Usuário não autenticado. Redirecionando para login.");
        window.location.href = "login.html"; // Redirecionar para login do usuário
        return;
    }

    try {
         // Parse do cache para obter o ID e nome rapidamente
         usuarioLogado = JSON.parse(usuarioCache);
         const nomeSpan = document.querySelector(".user-name");
         if (nomeSpan && usuarioLogado?.nome) {
             nomeSpan.textContent = usuarioLogado.nome;
         }


        // Chamada ao backend para validar o token e obter dados completos
         const res = await fetch('http://localhost:3000/perfil', {
             headers: { 'Authorization': 'Bearer ' + token }
         });

         const resClone = res.clone(); // Clonar para ler o body se der erro de JSON

         if (!res.ok) {
             if (res.status === 401 || res.status === 403) {
                 console.error("Token inválido ou expirado. Redirecionando para login.");
                 alert("Sua sessão expirou. Por favor, faça login novamente.");
                 window.location.href = "login.html";
                 return;
             }
             throw new Error(`Erro HTTP ao buscar perfil: ${res.status}`);
         }

        let data = {};
         try {
             data = await res.json();
         } catch(jsonError) {
             console.error("Erro ao parsear JSON do perfil:", await resClone.text());
             throw new Error("Resposta de perfil inválida.");
         }


        // Verifique se o perfil retornado é de um usuário cliente
         if (data.tipo !== 'usuario' || !data.usuario?._id) {
              console.error("Token válido, mas não corresponde a um usuário cliente.");
              alert("Acesso negado para este tipo de usuário.");
              // Redireciona para o dashboard do prestador se for um prestador
              window.location.href = "index.html"; // Assumindo que index.html é o dashboard do prestador
              return;
         }

         // Atualiza a variável global com os dados completos do usuário
         usuarioLogado = data.usuario;

        // Atualiza o nome na interface (se a chamada backend for bem sucedida)
        if (usuarioLogado?.nome && nomeSpan) {
            nomeSpan.textContent = usuarioLogado.nome;
        }

        console.log("Perfil do usuário carregado:", usuarioLogado);

        // Armazena a lista completa de serviços e popula o catálogo
        allServices = services; // Assume que 'services' é a lista completa
        populateCatalog(allServices);


    } catch (err) {
        console.error('Erro ao carregar perfil do usuário:', err);
         if (usuarioLogado) {
             alert('Erro ao validar sessão do usuário. Pode haver problemas na conexão.');
         } else {
             alert('Ocorreu um erro ao carregar informações do usuário.');
         }
    }
}


// Função para popular o catálogo com os serviços
function populateCatalog(servicesList) {
    const catalogGrid = document.querySelector('.service-catalog-grid');
    catalogGrid.innerHTML = ''; // Limpa o grid antes de popular

    if (servicesList.length === 0) {
        catalogGrid.innerHTML = '<p class="text-center col-12">Nenhum serviço encontrado com o filtro aplicado.</p>';
        return;
    }

    servicesList.forEach(service => {
        const serviceCard = document.createElement('div');
        serviceCard.classList.add('service-card');
        // Adiciona data attributes com os detalhes do serviço
        serviceCard.dataset.serviceType = service.type;
        serviceCard.dataset.serviceTitle = service.title;
        serviceCard.dataset.serviceDescription = service.description;
        serviceCard.dataset.servicePrice = service.price;
        serviceCard.dataset.serviceDetails = service.details; // Detalhes completos

        serviceCard.innerHTML = `
            <img src="${service.imageUrl}" alt="${service.title}" onerror="this.onerror=null;this.src='https://placehold.co/600x400/e0e0e0/333333?text=Imagem+Indisponível';">
            <div class="service-card-content">
                <h4>${service.title}</h4>
                <p class="description">${service.description}</p>
            </div>
            <div class="service-card-footer">
                <span class="price">R$ ${service.price.toFixed(2).replace('.', ',')}</span>
                <button class="select-button btn btn-primary">Solicitar</button>
            </div>
        `;

        // Adiciona listener de clique ao card (não apenas ao botão) para feedback visual
        serviceCard.addEventListener('click', () => {
            // Remove a classe 'selected' de todos os cards
            document.querySelectorAll('.service-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Adiciona a classe 'selected' ao card clicado
            serviceCard.classList.add('selected');
            // Abre o modal com os dados deste serviço
            openSolicitationModal({
                type: serviceCard.dataset.serviceType,
                title: serviceCard.dataset.serviceTitle,
                description: serviceCard.dataset.serviceDescription,
                price: parseFloat(serviceCard.dataset.servicePrice),
                details: serviceCard.dataset.serviceDetails
            });
        });


        catalogGrid.appendChild(serviceCard);
    });
}


// Função para abrir o modal de solicitação e preencher os dados
function openSolicitationModal(service) {
    // Preenche os detalhes do serviço no modal
    modalServiceTitleSpan.textContent = service.title;
    selectedServiceDescriptionSpan.textContent = service.description; // Descrição curta
    selectedServicePriceSpan.textContent = service.price.toFixed(2).replace('.', ','); // Preço formatado

    // Preenche os campos ocultos para envio ao backend
    serviceTypeInput.value = service.type;
    servicePriceInput.value = service.price; // Valor numérico
    serviceFullDescriptionInput.value = service.details || service.description; // Descrição completa ou curta


    // Preenche os dados do usuário logado (nome, email, telefone)
    if (usuarioLogado) {
         nomeClienteInput.value = usuarioLogado.nome || '';
         emailClienteInput.value = usuarioLogado.email || '';
         telefoneClienteInput.value = usuarioLogado.telefone || ''; // Preenche o telefone se existir no perfil
    } else {
         // Caso raro de usuário não logado chegar aqui, limpar campos
         nomeClienteInput.value = '';
         emailClienteInput.value = '';
         telefoneClienteInput.value = '';
    }

    // Limpa mensagens de validação anteriores
    clearValidationMessages();


    // Exibe o modal
    solicitationSection.style.display = 'flex'; // Usa flex para centralizar
}

// Função para fechar o modal de solicitação
function closeSolicitationModal() {
    solicitationSection.style.display = 'none'; // Esconde a seção
    solicitationForm.reset(); // Reseta o formulário ao fechar
    // Remove a classe 'selected' de todos os cards ao fechar o modal
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
     // Limpa mensagens de validação ao fechar
    clearValidationMessages();
}

// Adiciona listener para o botão de fechar do modal
closeSolicitationBtn.addEventListener('click', closeSolicitationModal);

// Fecha o modal se o usuário clicar fora dele
solicitationSection.addEventListener('click', (event) => {
    // Se o clique foi diretamente na seção (não dentro do container do formulário)
    if (event.target === solicitationSection) {
         closeSolicitationModal();
    }
});


// Função para validar o formulário antes de enviar
function validateForm() {
    let isValid = true;
    clearValidationMessages(); // Limpa mensagens anteriores

    // Validação do telefone (exemplo simples: verifica se não está vazio e um formato básico)
    const telefoneValue = telefoneClienteInput.value.trim();
    if (telefoneValue === '') {
        displayValidationMessage(telefoneClienteInput, 'Por favor, informe seu telefone.');
        isValid = false;
    } else if (!/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(telefoneValue)) {
         // Regex para formatos comuns: (XX) XXXX-XXXX, (XX) XXXXX-XXXX, XXXX-XXXX, XXXXX-XXXX, (XX)XXXX-XXXX etc.
         displayValidationMessage(telefoneClienteInput, 'Formato de telefone inválido (Ex: (XX) 9XXXX-XXXX ou (XX) XXXX-XXXX).');
         isValid = false;
    }

    // Adicione outras validações conforme necessário (ex: data, hora se forem obrigatórios)
    // Exemplo: Tornar data e hora obrigatórias se uma delas for preenchida
    const dataServicoValue = dataServicoInput.value;
    const horaServicoValue = horaServicoInput.value;

    if ((dataServicoValue && !horaServicoValue) || (!dataServicoValue && horaServicoValue)) {
         if (!dataServicoValue) {
              displayValidationMessage(dataServicoInput, 'Se informar a hora, informe a data também.');
              isValid = false;
         }
         if (!horaServicoValue) {
              displayValidationMessage(horaServicoInput, 'Se informar a data, informe a hora também.');
              isValid = false;
         }
    }


    return isValid;
}

// Função para exibir mensagem de validação
function displayValidationMessage(inputElement, message) {
    const formGroup = inputElement.closest('.form-group');
    if (formGroup) {
        let feedbackElement = formGroup.querySelector('.invalid-feedback');
        if (!feedbackElement) {
            feedbackElement = document.createElement('div');
            feedbackElement.classList.add('invalid-feedback');
            // Encontra o elemento onde a mensagem deve ser inserida (após o input)
            const insertAfter = inputElement.nextElementSibling || inputElement;
            insertAfter.parentNode.insertBefore(feedbackElement, insertAfter.nextSibling);
        }
        feedbackElement.textContent = message;
        inputElement.classList.add('is-invalid');
        feedbackElement.style.display = 'block'; // Mostra a mensagem
    }
}

// Função para limpar mensagens de validação
function clearValidationMessages() {
    document.querySelectorAll('.invalid-feedback').forEach(el => {
        el.textContent = '';
        el.style.display = 'none'; // Esconde a mensagem
    });
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('is-invalid');
    });
}


// Listener para o envio do formulário de solicitação
solicitationForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Previne o envio padrão do formulário

    // Valida o formulário antes de enviar
    if (!validateForm()) {
        console.log("Formulário inválido. Não enviando.");
        return; // Interrompe o envio se a validação falhar
    }

    // Coleta os dados do formulário
    const data = {
        nome_cliente: nomeClienteInput.value,
        email_cliente: emailClienteInput.value,
        telefone_cliente: telefoneClienteInput.value,
        endereco_servico: enderecoServicoInput.value,
        notas_adicionais: notasAdicionaisTextarea.value,
        tipo_servico: serviceTypeInput.value, // Pega do campo hidden
        descricao_servico: serviceFullDescriptionInput.value, // Pega do campo hidden (descrição completa)
        valor_servico: parseFloat(servicePriceInput.value), // Pega do campo hidden (valor numérico)
        urgente: urgenteCheckbox.checked, // Pega do checkbox
        data_servico_preferencial: dataServicoInput.value || null, // Data ou null
        hora_servico_preferencial: horaServicoInput.value || null // Hora ou null
    };

    console.log("Dados da solicitação a serem enviados:", data); // Log para depuração

    const token = localStorage.getItem('token');
    if (!token) {
         alert("Usuário não autenticado. Faça login novamente.");
         window.location.href = "login.html";
         return;
    }

     // Desabilitar o botão de envio enquanto a requisição está em andamento
     submitButton.disabled = true;
     submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...'; // Feedback com spinner
     // Adicionar classe para estilo de loading se necessário
     submitButton.classList.add('loading');


    try {
         const response = await fetch('http://localhost:3000/solicitar-servico', {
              method: 'POST',
              headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${token}` // Incluir o token
              },
              body: JSON.stringify(data)
         });

          // Verifica se a resposta não foi OK antes de tentar parsear JSON
          if (!response.ok) {
              // Tenta ler a resposta como texto para depuração antes de lançar o erro
              const errorText = await response.text();
              console.error("Erro HTTP ao solicitar serviço:", response.status, errorText);
              // Tenta parsear o texto como JSON para ver a mensagem de erro do backend
              try {
                  const errorJson = JSON.parse(errorText);
                  throw new Error(errorJson.message || errorText || `Erro HTTP: ${response.status}`);
              } catch (parseError) {
                  // Se não for JSON, lança o texto ou o status
                  throw new Error(errorText || `Erro HTTP: ${response.status}`);
              }
          }


         const result = await response.json(); // Leia a resposta JSON (agora deve ser JSON em caso de sucesso/erro do backend)

         alert(result.message || "Solicitação enviada com sucesso!");

         closeSolicitationModal(); // Fecha o modal após sucesso

         // Opcional: Redirecionar para a página "Meus Pedidos" após a solicitação
         // window.location.href = "contratos.html";

    } catch (error) {
         console.error('Erro ao enviar solicitação:', error);
         // Exiba a mensagem de erro do backend se disponível, caso contrário, uma genérica
         alert("Erro ao enviar solicitação: " + (error.message || "Verifique sua conexão ou tente novamente."));
    } finally {
         // Reabilitar o botão de envio
         submitButton.disabled = false;
         submitButton.innerHTML = "Enviar Solicitação"; // Restaura o texto original
         submitButton.classList.remove('loading'); // Remove classe de loading
    }
});


// Função para filtrar os serviços com base no input de busca
function filterServices() {
    const searchTerm = serviceSearchInput.value.toLowerCase();
    const filteredServices = allServices.filter(service => {
        // Busca no título ou na descrição curta
        return service.title.toLowerCase().includes(searchTerm) ||
               service.description.toLowerCase().includes(searchTerm);
    });
    populateCatalog(filteredServices); // Popula o catálogo com os serviços filtrados
}

// Adiciona listener para o evento 'input' no campo de busca
serviceSearchInput.addEventListener('input', filterServices);


// Chamar carregarPerfilUsuario ao carregar a página
document.addEventListener("DOMContentLoaded", carregarPerfilUsuario);

