const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Importar 'fs' para operações de arquivo
const mercadopago = require('mercadopago'); // Importar SDK do Mercado Pago
const nodemailer = require('nodemailer'); // Importar Nodemailer
const crypto = require('crypto'); // Importar crypto para gerar tokens
const { GoogleGenerativeAI } = require('@google/generative-ai'); // NOVO: Importar a biblioteca Gemini API

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// --- Configuração do Mercado Pago ---
// Crie uma instância da configuração usando o Access Token da variável de ambiente MP_ACCESS_TOKEN
// Certifique-se de que a variável MP_ACCESS_TOKEN está definida no seu arquivo .env
const client = new mercadopago.MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN, // Lê o token da variável de ambiente
    options: { timeout: 5000 } // Opcional: configurar timeout
});

// Crie instâncias dos recursos que você vai usar
const preference = new mercadopago.Preference(client);
const payment = new mercadopago.Payment(client);
// --- Fim Configuração Mercado Pago ---

// --- Configuração do Nodemailer (Para envio de emails) ---
// Você precisará configurar suas credenciais e serviço de email aqui
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // Ex: 'gmail', 'SendGrid', etc.
    auth: {
        user: process.env.EMAIL_USER, // Seu email
        pass: process.env.EMAIL_PASS  // Sua senha ou App Password
    }
});
// --- Fim Configuração Nodemailer ---

// --- Configuração da Gemini API ---
// Certifique-se de que a variável de ambiente GEMINI_API_KEY está definida no seu arquivo .env
// e que a chave tem as permissões corretas para acessar a Gemini API.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Acessa a chave de API do ambiente
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
// --- Fim Configuração da Gemini API ---


// --- Inicializa a aplicação Express ---
const app = express();
// --- Fim Inicialização Express ---

// Middleware para permitir CORS
app.use(cors());

// Middleware para servir arquivos estáticos da pasta 'uploads'
// Isso permite que as fotos de perfil e comprovantes sejam acessados via URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware para parsear JSON no corpo das requisições (ADICIONADO GLOBALMENTE AQUI)
app.use(express.json());

// --- Variável de ambiente para a URL base do backend ---
// Em produção, process.env.BACKEND_BASE_URL deve ser a URL do seu deploy (ex: https://wyn-backend.onrender.com)
// Em desenvolvimento, será 'http://localhost:3000'
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:3000';


// Configuração da URI do MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wyn_project';

// Conexão com o MongoDB
mongoose.connect(mongoURI)
    .then(() => {
        app.listen(3000, () => {
            console.log('Conectado ao MongoDB');
            console.log('Servidor iniciado na porta 3000');
        });
    })
    .catch((err) => {
        console.error('Erro ao conectar ao MongoDB:', err);
        process.exit(1); // Sai do processo em caso de erro na conexão
    });

// --- Configuração do Multer para Upload de Arquivos ---
// Configuração de storage para salvar arquivos na pasta 'uploads'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Verifica se a pasta 'uploads' existe, se não, cria
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, 'uploads/'); // Pasta onde os arquivos serão salvos
    },
    filename: function (req, file, cb) {
        // Gera um nome de arquivo único com timestamp e o nome original
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Filtro de arquivos para permitir apenas imagens (para foto de perfil)
const profilePictureFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Aceita o arquivo
    } else {
        cb(new Error('Tipo de arquivo de imagem não permitido. Apenas JPEG, PNG, GIF, BMP e WebP são aceitos.'), false); // Rejeita o arquivo
    }
};

// Filtro de arquivos para permitir imagens e PDFs (para comprovação de serviço)
const serviceComprovationFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Aceita o arquivo
    } else {
        cb(new Error('Tipo de arquivo de comprovação não permitido. Apenas imagens e PDFs são aceitos.'), false); // Rejeita o arquivo
    }
};


// Instância do Multer para upload de foto de perfil (single file)
const uploadProfilePicture = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 2 // Limite de 2MB por foto de perfil
    },
    fileFilter: profilePictureFilter
}).single('foto_perfil'); // O nome do campo no formulário HTML será 'foto_perfil'

// Instância do Multer para upload de comprovantes de serviço (multiple files)
const uploadServiceComprovations = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // Limite de 5MB por arquivo de comprovação
    },
    fileFilter: serviceComprovationFilter
}).array('comprovacaoImagem', 5);


// --- Modelos ---
const ServicoSchema = new mongoose.Schema({
    nome_cliente: { type: String, required: true },
    email_cliente: { type: String, required: true },
    telefone_cliente: { type: String }, // REMOVIDO required: true
    endereco_servico: { type: String },
    notas_adicionais: { type: String },
    tipo_servico: { type: String, required: true }, // Nome do serviço (copiado do ServicoOferecido)
    descricao_servico: { type: String }, // Descrição (copiado do ServicoOferecido)
    valor_servico: { type: Number }, // Valor final acordado (pode ser preenchido depois)
    urgente: { type: Boolean, required: true },
    data_solicitacao: { type: Date, default: Date.now },
    data_servico_preferencial: { type: Date, default: null },
    hora_servico_preferencial: { type: String, default: null },
    status: {
        type: String,
        default: 'aguardando_aceite_prestador',
        enum: [
            'aguardando_aceite_prestador',
            'aguardando_pagamento_cliente',
            'aguardando_confirmacao_pagamento',
            'aceito_pelo_prestador',
            'recusado_pelo_prestador',
            'concluido_pelo_prestador',
            'avaliado_pelo_cliente',
            'cancelado'
        ]
    },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    prestador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador' }, // Prestador que aceitou/executou
    servico_oferecido_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicoOferecido' }, // Link para o serviço oferecido no catálogo
    payment_link: { type: String },
    data_aceite: { type: Date, default: null }, // Adicionado para controle do admin
    data_conclusao: { type: Date, default: null } // Adicionado para controle do admin
});
const Servico = mongoose.model('Servico', ServicoSchema);

const UsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    telefone: { type: String },
    foto_perfil: { type: String }, // Caminho relativo no servidor
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    isAdmin: { type: Boolean, default: false } // --- CAMPO ADICIONADO PARA ADMIN ---
});
const Usuario = mongoose.model('Usuario', UsuarioSchema);

const PrestadorSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    telefone: { type: String },
    foto_perfil: { type: String }, // Caminho relativo no servidor
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    especialidades: [{ type: String }], // Adicionado para prestador
    area_atuacao: { type: String }, // Adicionado para prestador
    disponibilidade: { type: String } // Adicionado para prestador
});
const Prestador = mongoose.model('Prestador', PrestadorSchema);


const AvaliacaoSchema = new mongoose.Schema({
    pedido_servico_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Servico', required: true, unique: true },
    cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    prestador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
    nota: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String },
    data_avaliacao: { type: Date, default: Date.now }
});
const Avaliacao = mongoose.model('Avaliacao', AvaliacaoSchema);

const ComprovacaoServicoSchema = new mongoose.Schema({
    pedido_servico_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Servico', required: true },
    caminho_arquivo: { type: String, required: true },
    nome_arquivo_original: { type: String },
    data_upload: { type: Date, default: Date.now }
});
const ComprovacaoServico = mongoose.model('ComprovacaoServico', ComprovacaoServicoSchema);

const MessageSchema = new mongoose.Schema({
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Servico', required: true },
    remetente_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    remetente_tipo: { type: String, required: true, enum: ['usuario', 'prestador'] },
    remetente_nome_cache: { type: String, required: true },
    conteudo: { type: String, required: true },
    data_envio: { type: Date, default: Date.now },
    lido_por: [{ type: mongoose.Schema.Types.ObjectId }]
});
const Message = mongoose.model('Message', MessageSchema);

const ServicoOferecidoSchema = new mongoose.Schema({
    prestador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
    nome: { type: String, required: true },
    descricao: { type: String },
    faixa_preco_min: { type: Number, min: 0 },
    faixa_preco_max: { type: Number, min: 0 },
    categorias: [{ type: String }]
});
const ServicoOferecido = mongoose.model('ServicoOferecido', ServicoOferecidoSchema);

// --- NOVO MODELO: Disponibilidade do Prestador ---
const PrestadorDisponibilidadeSchema = new mongoose.Schema({
    prestador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true, unique: true },
    horario_inicio_padrao: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }, // Formato HH:mm
    horario_fim_padrao: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }, // Formato HH:mm
    dias_disponiveis: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    temporariamente_indisponivel: { type: Boolean, default: false },
    periodos_indisponibilidade_especificos: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // ID único para cada período específico
        data_inicio: { type: Date, required: true },
        data_fim: { type: Date, required: true },
        motivo: { type: String }
    }]
});
const PrestadorDisponibilidade = mongoose.model('PrestadorDisponibilidade', PrestadorDisponibilidadeSchema);

// --- FIM NOVO MODELO ---

// --- NOVO MODELO: Notificação ---
const NotificationSchema = new mongoose.Schema({
    recipient_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID do usuário ou prestador que receberá a notificação
    recipient_type: { type: String, required: true, enum: ['usuario', 'prestador'] }, // Tipo do destinatário
    type: {
        type: String,
        required: true,
        enum: [
            'new_message',
            'new_solicitation', // Nova solicitação para o prestador
            'solicitation_accepted', // Solicitação aceita pelo prestador (para o cliente)
            'solicitation_rejected', // Solicitação recusada pelo prestador (para o cliente)
            'payment_received', // Pagamento recebido (para o prestador)
            'service_concluded', // Serviço marcado como concluído (para o cliente)
            'new_review', // Nova avaliação recebida (para o prestador)
            'password_reset' // Confirmação de redefinição de senha
            // Adicionar outros tipos conforme necessário
        ]
    },
    summary: { type: String, required: true }, // Breve resumo para exibir no sino
    message: { type: String }, // Mensagem completa (opcional)
    timestamp: { type: Date, default: Date.now },
    lida: { type: Boolean, default: false },
    referenciaId: { type: mongoose.Schema.Types.ObjectId }, // ID do objeto relacionado (serviço, chat, etc.)
    referenciaModel: { type: String, enum: ['Servico', 'Message', 'Avaliacao', 'ChatRoom'] } // Modelo do objeto relacionado
});
const Notification = mongoose.model('Notification', NotificationSchema);
// --- FIM NOVO MODELO: Notificação ---


// --- Validação Joi ---
// Validação para a SOLICITAÇÃO de serviço pelo cliente (agora baseada em um serviço oferecido)
const validateSolicitarServico = (data) => {
    const schema = Joi.object({
        servico_oferecido_id: Joi.string().required(), // ID do serviço oferecido no catálogo
        prestador_id: Joi.string().required(), // ID do prestador que oferece o serviço
        data_servico_preferencial: Joi.date().allow(null).optional(),
        hora_servico_preferencial: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow(null).optional(),
        endereco_servico: Joi.string().required(), // Endereço onde o serviço será realizado
        notas_adicionais: Joi.string().allow('', null).optional(),
        urgente: Joi.boolean().required(),
        // cliente_id é pego do token, nome/email/telefone do cliente podem ser pegos do perfil do usuário logado
        // tipo_servico, descricao_servico, valor_servico serão copiados/definidos no backend
    });
    return schema.validate(data);
};


const validateAvaliacao = (data) => {
    const schema = Joi.object({
        nota: Joi.number().integer().min(1).max(5).required(),
        comentario: Joi.string().optional().allow(null, ''),
    });
    return schema.validate(data);
};

const validateCadastroUsuario = (data) => {
     const schema = Joi.object({
          nome: Joi.string().required(),
          email: Joi.string().email().required(),
          senha: Joi.string().min(6).required(),
          telefone: Joi.string().allow(null, '').optional(),
     });
     return schema.validate(data);
};

const validateCadastroPrestador = (data) => {
     const schema = Joi.object({
          nome: Joi.string().required(),
          email: Joi.string().email().required(),
          senha: Joi.string().min(6).required(),
          telefone: Joi.string().allow(null, '').optional(),
     });
     return schema.validate(data);
};

const validateMessage = (data) => {
    const schema = Joi.object({
        serviceId: Joi.string().required(),
        conteudo: Joi.string().required()
    });
    return schema.validate(data);
};

const validateForgotPassword = (data) => {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    return schema.validate(data);
};

const validateResetPassword = (data) => {
    const schema = Joi.object({
        token: Joi.string().required(),
        novaSenha: Joi.string().min(6).required()
    });
    return schema.validate(data);
};

// --- FUNÇÃO DE VALIDAÇÃO CORRIGIDA ---
const validateServicoOferecido = (data) => {
    const schema = Joi.object({
        // prestador_id NÃO é mais obrigatório no corpo da requisição, pois é pego do token
        // prestador_id: Joi.string().required(), // Removido
        nome: Joi.string().required(),
        descricao: Joi.string().allow('', null).optional(),
        faixa_preco_min: Joi.number().min(0).allow(null).optional(),
        faixa_preco_max: Joi.number().min(0).allow(null).optional(),
        categorias: Joi.array().items(Joi.string()).optional().default([])
    });
    return schema.validate(data);
};
// --- FIM FUNÇÃO DE VALIDAÇÃO CORRIGIDA ---


// Validação Joi para Disponibilidade
const validatePrestadorDisponibilidade = (data) => {
    const schema = Joi.object({
        horario_inicio_padrao: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        horario_fim_padrao: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        dias_disponiveis: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')).min(1).required(),
        temporariamente_indisponivel: Joi.boolean().default(false)
    });
    return schema.validate(data);
};

const validatePeriodoIndisponibilidade = (data) => {
    const schema = Joi.object({
        data_inicio: Joi.date().required(),
        data_fim: Joi.date().required().min(Joi.ref('data_inicio')), // Data fim deve ser igual ou posterior à data início
        motivo: Joi.string().allow('', null).optional()
    });
    return schema.validate(data);
};

// --- NOVA VALIDAÇÃO JOI PARA ADMIN ---
const validateAdminUsuarioUpdate = (data) => {
    const schema = Joi.object({
        nome: Joi.string().optional(),
        email: Joi.string().email().optional(),
        telefone: Joi.string().allow(null, '').optional(),
        // Senha não é validada aqui, pois o admin não muda a senha diretamente no formulário de edição
        // isAdmin: Joi.boolean().optional() // O admin pode mudar o status de admin de outros usuários
    }).min(1); // Pelo menos um campo deve ser fornecido para atualização
    return schema.validate(data);
};

const validateAdminPrestadorUpdate = (data) => {
    const schema = Joi.object({
        nome: Joi.string().optional(),
        email: Joi.string().email().optional(),
        telefone: Joi.string().allow(null, '').optional(),
        // Senha não é validada aqui
    }).min(1);
    return schema.validate(data);
};

const validateAdminServicoOferecidoUpdate = (data) => {
    const schema = Joi.object({
        prestador_id: Joi.string().optional(), // Admin pode reatribuir o prestador
        nome: Joi.string().optional(),
        descricao: Joi.string().allow('', null).optional(),
        faixa_preco_min: Joi.number().min(0).allow(null).optional(),
        faixa_preco_max: Joi.number().min(0).allow(null).optional(),
        categorias: Joi.array().items(Joi.string()).optional()
    }).min(1);
    return schema.validate(data);
};

const validateAdminServicoUpdate = (data) => {
    const schema = Joi.object({
        // Admin pode mudar o prestador atribuído
        prestador_id: Joi.string().allow(null).optional(),
        // Admin pode mudar o status do serviço
        status: Joi.string().valid(
            'aguardando_aceite_prestador',
            'aguardando_pagamento_cliente',
            'aguardando_confirmacao_pagamento',
            'aceito_pelo_prestador',
            'recusado_pelo_prestador',
            'concluido_pelo_prestador',
            'avaliado_pelo_cliente',
            'cancelado'
        ).optional(),
        // Admin pode ajustar o valor do serviço
        valor_servico: Joi.number().min(0).allow(null).optional(),
        // Admin pode ajustar datas/horários (opcional)
        data_servico_preferencial: Joi.date().allow(null).optional(),
        hora_servico_preferencial: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow(null).optional(),
        // Outros campos que o admin pode querer ajustar (endereço, notas, etc.)
        endereco_servico: Joi.string().optional(),
        notas_adicionais: Joi.string().allow('', null).optional(),
        urgente: Joi.boolean().optional()

    }).min(1); // Pelo menos um campo deve ser fornecido para atualização
    return schema.validate(data);
};

// --- NOVAS VALIDAÇÕES JOI PARA ATUALIZAÇÃO DE PERFIL DO USUÁRIO E PRESTADOR ---
const validateUsuarioUpdate = (data) => {
    const schema = Joi.object({
        nome: Joi.string().optional(),
        telefone: Joi.string().allow(null, '').optional(),
    }).min(1); // Pelo menos um campo deve ser fornecido para atualização
    return schema.validate(data);
};

const validatePrestadorUpdate = (data) => {
    const schema = Joi.object({
        nome: Joi.string().optional(),
        telefone: Joi.string().allow(null, '').optional(),
        especialidades: Joi.array().items(Joi.string()).optional(),
        area_atuacao: Joi.string().allow(null, '').optional(),
        disponibilidade: Joi.string().allow(null, '').optional()
    }).min(1); // Pelo menos um campo deve ser fornecido para atualização
    return schema.validate(data);
};
// --- FIM NOVAS VALIDAÇÕES JOI ---


// --- FIM Validação Joi ---


// --- Middleware de autenticação ---
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.warn("[AUTH] Acesso negado: Token não fornecido.");
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        req.user = decoded; // { id: ID_DO_USUARIO/PRESTADOR, tipo: 'usuario' ou 'prestador' }
        next();
    } catch (error) {
        console.error("[AUTH] Erro na verificação do token:", error.message);
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};

const authMiddlewarePrestador = (req, res, next) => {
     authMiddleware(req, res, () => {
          if (req.user && req.user.tipo === 'prestador') {
               next();
          } else {
               console.warn("[AUTH] Acesso negado: Necessário perfil de prestador.");
               res.status(403).json({ message: 'Acesso negado. Necessário perfil de prestador.' });
          }
     });
};

const authMiddlewareUsuario = (req, res, next) => {
     authMiddleware(req, res, () => {
          if (req.user && req.user.tipo === 'usuario') {
               next();
          } else {
               console.warn("[AUTH] Acesso negado: Necessário perfil de usuário cliente.");
               res.status(403).json({ message: 'Acesso negado. Necessário perfil de usuário cliente.' });
          }
     });
};

// NOVO MIDDLEWARE: Permite tanto 'usuario' quanto 'prestador'
const authMiddlewareUsuarioOuPrestador = (req, res, next) => {
    authMiddleware(req, res, () => {
        if (req.user && (req.user.tipo === 'usuario' || req.user.tipo === 'prestador')) {
            next();
        } else {
            console.warn("[AUTH] Acesso negado: Necessário perfil de usuário ou prestador.");
            res.status(403).json({ message: 'Acesso negado. Necessário perfil de usuário ou prestador.' });
        }
    });
};


const isServiceParticipant = async (req, res, next) => {
    const serviceId = req.params.serviceId || req.body.serviceId;

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        console.warn("[AUTH] isServiceParticipant: ID do serviço inválido ou ausente.");
        return res.status(400).json({ message: 'ID do serviço inválido ou ausente.' });
    }

    try {
        // Popula usuario_id e prestador_id para facilitar a verificação
        const servico = await Servico.findById(serviceId).populate('usuario_id', '_id').populate('prestador_id', '_id');

        if (!servico) {
            console.warn(`[AUTH] isServiceParticipant: Serviço com ID ${serviceId} não encontrado.`);
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const isClient = req.user.tipo === 'usuario' && servico.usuario_id && servico.usuario_id._id.toString() === req.user.id;
        const isPrestador = req.user.tipo === 'prestador' && servico.prestador_id && servico.prestador_id._id.toString() === req.user.id;

        if (isClient || isPrestador) {
            req.servico = servico; // Anexa o objeto service à requisição para uso posterior
            next();
        } else {
            console.warn(`[AUTH] isServiceParticipant: Usuário ${req.user.id} (${req.user.tipo}) tentou acessar recurso do serviço ${serviceId} sem permissão.`);
            res.status(403).json({ message: 'Você não tem permissão para acessar este recurso do serviço.' });
        }

    } catch (error) {
        console.error('[AUTH] Erro ao verificar participação no serviço:', error);
        res.status(500).json({ message: 'Erro ao verificar permissões do serviço.' });
    }
};

// --- NOVO MIDDLEWARE DE AUTENTICAÇÃO PARA ADMIN ---
const adminAuthMiddleware = async (req, res, next) => {
     authMiddleware(req, res, async () => { // Reutiliza o middleware de autenticação base
          if (req.user && req.user.tipo === 'usuario') {
               try {
                    const usuario = await Usuario.findById(req.user.id).select('isAdmin');
                    if (usuario && usuario.isAdmin) {
                         next(); // É um usuário e é admin
                    } else {
                         console.warn(`[AUTH] Acesso negado: Usuário ${req.user.id} não é administrador.`);
                         res.status(403).json({ message: 'Acesso negado. Necessário ser administrador.' });
                    }
               } catch (error) {
                    console.error('[AUTH] Erro ao verificar status de admin:', error);
                    res.status(500).json({ message: 'Erro ao verificar permissões.' });
               }
          } else {
               console.warn("[AUTH] Acesso negado: Necessário perfil de usuário para ser administrador.");
               res.status(403).json({ message: 'Acesso negado. Necessário perfil de usuário para ser administrador.' });
          }
     });
};
// --- FIM NOVO MIDDLEWARE ---


// --- Função para criar Notificações ---
async function createNotification(recipientId, recipientType, type, summary, message, referenciaId, referenciaModel) {
    try {
        const newNotification = new Notification({
            recipient_id: recipientId,
            recipient_type: recipientType,
            type: type,
            summary: summary,
            message: message,
            referenciaId: referenciaId,
            referenciaModel: referenciaModel,
            timestamp: new Date(),
            lida: false
        });
        await newNotification.save();
        console.log(`[NOTIFICATION] Notificação criada: Tipo=${type}, Destinatário=${recipientType}:${recipientId}, Referência=${referenciaModel}:${referenciaId}`);
    } catch (error) {
        console.error('[NOTIFICATION] Erro ao criar notificação:', error);
    }
}
// --- Fim Função para criar Notificações ---


// --- Rotas ---

// Cliente solicita um serviço (MODIFICADA para usar ServicoOferecido e criar notificação para o prestador)
app.post('/solicitar-servico', authMiddlewareUsuario, async (req, res) => {
    try {
        console.log('[BACKEND] Recebida requisição POST /solicitar-servico');
        console.log('[BACKEND] Dados recebidos para solicitar serviço:', req.body);

        const { error, value } = validateSolicitarServico(req.body);
        if (error) {
             console.error("[BACKEND] Erro de validação Joi na solicitação:", error.details);
             return res.status(400).json({ message: error.details[0].message });
        }

        // Buscar informações do usuário logado (cliente)
        const usuario = await Usuario.findById(req.user.id).select('nome email telefone');
        if (!usuario) {
            console.warn(`[BACKEND] Usuário cliente ${req.user.id} não encontrado ao solicitar serviço.`);
            return res.status(404).json({ message: 'Usuário cliente não encontrado.' });
        }

        // Buscar informações do serviço oferecido selecionado
        const servicoOferecido = await ServicoOferecido.findById(value.servico_oferecido_id);
        if (!servicoOferecido) {
             console.warn(`[BACKEND] Serviço oferecido no catálogo com ID ${value.servico_oferecido_id} não encontrado.`);
             return res.status(404).json({ message: 'Serviço oferecido no catálogo não encontrado.' });
        }

        // Verificar se o prestador_id enviado no body corresponde ao prestador do ServicoOferecido
        if (servicoOferecido.prestador_id.toString() !== value.prestador_id) {
             console.warn(`[BACKEND] Tentativa de solicitar serviço ${value.servico_oferecido_id} com prestador_id ${value.prestador_id} que não corresponde ao prestador do serviço (${servicoOferecido.prestador_id}).`);
             return res.status(400).json({ message: 'ID do prestador não corresponde ao serviço oferecido.' });
        }


        const novaSolicitacao = new Servico({
            nome_cliente: usuario.nome,
            email_cliente: usuario.email,
            telefone_cliente: usuario.telefone, // Agora não é mais obrigatório pelo Schema
            endereco_servico: value.endereco_servico,
            notas_adicionais: value.notas_adicionais,
            tipo_servico: servicoOferecido.nome, // Copia o nome do serviço oferecido
            descricao_servico: servicoOferecido.descricao, // Copia a descrição do serviço oferecido
            valor_servico: null, // O valor será definido pelo prestador ao aceitar
            urgente: value.urgente,
            data_solicitacao: new Date(),
            data_servico_preferencial: value.data_servico_preferencial,
            hora_servico_preferencial: value.hora_servico_preferencial,
            status: 'aguardando_aceite_prestador',
            usuario_id: req.user.id, // ID do cliente logado
            prestador_id: value.prestador_id, // ID do prestador selecionado
            servico_oferecido_id: value.servico_oferecido_id // Link para o serviço oferecido
        });

        console.log('[BACKEND] Tentando salvar nova solicitação:', novaSolicitacao);

        await novaSolicitacao.save();

        console.log('[BACKEND] Solicitação salva com sucesso! ID:', novaSolicitacao._id);

        // --- Criar Notificação para o Prestador ---
        await createNotification(
            novaSolicitacao.prestador_id,
            'prestador',
            'new_solicitation',
            `Nova solicitação de ${novaSolicitacao.tipo_servico} de ${novaSolicitacao.nome_cliente}`,
            `Você recebeu uma nova solicitação de serviço (${novaSolicitacao.tipo_servico}) do cliente ${novaSolicitacao.nome_cliente}.`,
            novaSolicitacao._id,
            'Servico'
        );
        // --- Fim Criar Notificação ---


        res.status(201).json({ message: 'Solicitação criada com sucesso! Aguardando aceite do prestador.', id: novaSolicitacao._id });
    } catch (error) {
        console.error('[BACKEND] Erro ao solicitar serviço:', error);
        res.status(500).json({ message: error.message || 'Erro no servidor ao solicitar serviço.' });
    }
});

// Cliente vê seus serviços
app.get('/meus-servicos', authMiddlewareUsuario, async (req, res) => {
    try {
        console.log('[BACKEND] Recebida requisição GET /meus-servicos para usuário:', req.user.id);
        const servicosDoCliente = await Servico.find({ usuario_id: req.user.id })
            .populate('prestador_id', 'nome') // Popula o nome do prestador
            .populate('servico_oferecido_id', 'nome'); // Popula o nome do serviço oferecido (catálogo)

        // Formata a resposta para incluir nomes populados
        const formattedServicos = servicosDoCliente.map(servico => ({
            ...servico.toObject(),
            nome_prestador: servico.prestador_id ? servico.prestador_id.nome : 'Prestador Não Atribuído',
            nome_servico_oferecido: servico.servico_oferecido_id ? servico.servico_oferecido_id.nome : servico.tipo_servico // Usa nome do catálogo se disponível
        }));

        console.log(`[BACKEND] Encontrados ${formattedServicos.length} serviços para o cliente.`);
        res.status(200).json(formattedServicos);
    } catch (error) {
        console.error('[BACKEND] Erro ao buscar serviços do cliente:', error);
        res.status(500).json({ message: 'Erro ao buscar serviços do cliente.' });
    }
});


// Prestador vê solicitações PENDENTES (para ele escolher aceitar)
app.get('/solicitacoes-servicos-pendentes', authMiddlewarePrestador, async (req, res) => {
    try {
        console.log('[BACKEND] Recebida requisição GET /solicitacoes-servicos-pendentes para prestador:', req.user.id);
         // Busca serviços com status 'aguardando_aceite_prestador' que AINDA NÃO FORAM ACEITOS
         // E que foram direcionados a este prestador (se o cliente selecionou um prestador específico)
         // OU solicitações gerais que ele pode "pegar" (se sua lógica permitir) - a lógica atual associa prestador_id na criação
        const solicitacoes = await Servico.find({
             status: 'aguardando_aceite_prestador',
             prestador_id: req.user.id // Busca solicitações direcionadas a este prestador
             // Se você tiver um fluxo onde prestadores podem "pegar" solicitações não atribuídas,
             // a query precisaria ser ajustada (ex: { status: 'aguardando_aceite_prestador', $or: [{ prestador_id: { $exists: false } }] })
        })
        .populate('usuario_id', 'nome email telefone') // Popula dados do cliente
        .populate('servico_oferecido_id', 'nome descricao'); // Popula dados do serviço oferecido (catálogo)


        // Formata a resposta para incluir nomes populados
        const formattedSolicitacoes = solicitacoes.map(solicitacao => ({
             ...solicitacao.toObject(),
             nome_cliente: solicitacao.usuario_id ? solicitacao.usuario_id.nome : 'Cliente Desconhecido',
             email_cliente: solicitacao.usuario_id ? solicitacao.usuario_id.email : 'Email Desconhecido',
             telefone_cliente: solicitacao.usuario_id ? solicitacao.usuario_id.telefone : 'Telefone Desconhecido',
             nome_servico_oferecido: solicitacao.servico_oferecido_id ? solicitacao.servico_oferecido_id.nome : solicitacao.tipo_servico // Usa nome do catálogo se disponível
        }));

        console.log(`[BACKEND] Encontradas ${formattedSolicitacoes.length} solicitações pendentes para o prestador.`);
        res.status(200).json(formattedSolicitacoes);
    } catch (error) {
        console.error('[BACKEND] Erro ao obter solicitações pendentes:', error);
        res.status(500).json({ message: 'Erro ao obter solicitações pendentes.', error });
    }
});

// Prestador vê os serviços que ELE aceitou (aguardando pagamento ou em andamento)
app.get('/meus-servicos-prestador', authMiddlewarePrestador, async (req, res) => {
     try {
          console.log('[BACKEND] Recebida requisição GET /meus-servicos-prestador para prestador:', req.user.id);
          const meusServicos = await Servico.find({
               prestador_id: req.user.id,
               status: { $in: ['aguardando_pagamento_cliente', 'aceito_pelo_prestador'] }
          })
          .populate('usuario_id', 'nome email') // Popula dados do cliente
          .populate('servico_oferecido_id', 'nome'); // Popula dados do serviço oferecido (catálogo)

          // Formata a resposta para incluir nomes populados
          const formattedMeusServicos = meusServicos.map(servico => ({
               ...servico.toObject(),
               nome_cliente: servico.usuario_id ? servico.usuario_id.nome : 'Cliente Desconhecido',
               nome_servico_oferecido: servico.servico_oferecido_id ? servico.servico_oferecido_id.nome : servico.tipo_servico // Usa nome do catálogo se disponível
          }));

          console.log(`[BACKEND] Encontrados ${formattedMeusServicos.length} serviços aceitos para o prestador.`);
          res.status(200).json(formattedMeusServicos);
     } catch (error) {
          console.error('[BACKEND] Erro ao buscar serviços do prestador:', error);
          res.status(500).json({ message: 'Erro ao buscar serviços do prestador.' });
     }
});

// Prestador Aceita um serviço (Muda status para aguardando pagamento e gera link MP) (MODIFICADA para criar notificação para o cliente)
app.post('/aceitar-servico/:id', authMiddlewarePrestador, async (req, res) => {
    try {
        console.log(`[BACKEND] Recebida requisição POST /aceitar-servico/${req.params.id}`);
        const { id } = req.params; // ID do serviço (pedido do cliente)
        const { valor_servico } = req.body; // Prestador informa o valor final

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Aceitar Serviço: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID inválido.' });
        }

        // Encontra o serviço apenas se ele estiver AGUARDANDO ACEITE deste prestador
        const servico = await Servico.findOne({
            _id: id,
            status: 'aguardando_aceite_prestador',
            prestador_id: req.user.id // Garante que este prestador foi o que recebeu a solicitação
        }).populate('usuario_id', 'nome'); // Popula o nome do cliente para a notificação

        if (!servico) {
            console.warn(`[BACKEND] Aceitar Serviço: Serviço ${id} não encontrado, já aceito, recusado ou não está aguardando aceite para o prestador ${req.user.id}.`);
            return res.status(404).json({ message: 'Serviço não encontrado, já aceito, recusado ou não está aguardando aceite para você.' });
        }

         // Validar se o valor do serviço foi fornecido e é válido
         if (valor_servico === undefined || valor_servico === null || valor_servico <= 0) {
              console.warn(`[BACKEND] Aceitar Serviço: Valor do serviço inválido recebido: ${valor_servico}`);
              return res.status(400).json({ message: 'O valor do serviço deve ser informado e ser maior que zero para aceitar.' });
         }

        console.log(`[BACKEND] Aceitando serviço ${id} com valor ${valor_servico}. Gerando link de pagamento...`);

        // --- Gerar link de pagamento do Mercado Pago ---
        const body = {
            items: [
                {
                    title: `Serviço: ${servico.tipo_servico}`, // Usa o nome do serviço do pedido
                    description: servico.descricao_servico || 'Serviço',
                    unit_price: parseFloat(parseFloat(valor_servico).toFixed(2)), // Usa o valor informado pelo prestador
                    quantity: 1,
                }
            ],
            notification_url: process.env.MP_WEBHOOK_URL || 'YOUR_WEBHOOK_URL', // <-- ATUALIZE ESTA URL NO SEU .env
            external_reference: servico._id.toString(),
            back_urls: {
                 success: process.env.CLIENT_BASE_URL + `/contratos.html?payment=success&serviceId=${servico._id}`,
                 failure: process.env.CLIENT_BASE_URL + `/pagamento-pendente.html?payment=failure&serviceId=${servico._id}`,
                 pending: process.env.CLIENT_BASE_URL + `/pagamento-pendente.html?payment=pending&serviceId=${servico._id}`
            },
        };

        const preferenceResponse = await preference.create({ body });
        const paymentLink = preferenceResponse.init_point;

        console.log(`[BACKEND] Link de pagamento gerado: ${paymentLink}`);


        // Atualiza o serviço com o valor definido pelo prestador, o novo status e o link de pagamento
        servico.valor_servico = parseFloat(parseFloat(valor_servico).toFixed(2)); // Salva o valor definido pelo prestador
        servico.status = 'aguardando_pagamento_cliente';
        servico.payment_link = paymentLink;
        servico.data_aceite = new Date(); // Marca a data de aceite
        await servico.save();

        console.log(`[BACKEND] Serviço ${id} atualizado para status 'aguardando_pagamento_cliente' com link de pagamento.`);

        // --- Criar Notificação para o Cliente ---
        if (servico.usuario_id) {
             await createNotification(
                 servico.usuario_id._id,
                 'usuario',
                 'solicitation_accepted',
                 `Sua solicitação de ${servico.tipo_servico} foi aceita!`,
                 `O prestador aceitou sua solicitação de ${servico.tipo_servico} e definiu o valor de R$ ${servico.valor_servico.toFixed(2).replace('.', ',')}. Por favor, realize o pagamento para prosseguir.`,
                 servico._id,
                 'Servico'
             );
        }
        // --- Fim Criar Notificação ---


        res.status(200).json({ message: 'Serviço aceito com sucesso! Aguardando pagamento do cliente.', servico });

    } catch (error) {
        console.error('[BACKEND] Erro ao aceitar serviço e gerar link de pagamento:', error);
        res.status(500).json({ message: 'Erro no servidor ao aceitar serviço ou gerar pagamento.', error: error.message });
    }
});

// Prestador Recusa um serviço PENDENTE (MODIFICADA para criar notificação para o cliente)
app.post('/recusar-servico/:id', authMiddlewarePrestador, async (req, res) => {
     try {
          console.log(`[BACKEND] Recebida requisição POST /recusar-servico/${req.params.id}`);
          const { id } = req.params; // ID do serviço (pedido do cliente)
          if (!mongoose.Types.ObjectId.isValid(id)) {
               console.warn(`[BACKEND] Recusar Serviço: ID inválido recebido: ${id}`);
               return res.status(400).json({ message: 'ID inválido.' });
          }

          // Encontra o serviço apenas se ele estiver AGUARDANDO ACEITE deste prestador
          const servico = await Servico.findOneAndUpdate(
               { _id: id, status: 'aguardando_aceite_prestador', prestador_id: req.user.id },
               { status: 'recusado_pelo_prestador' },
               { new: true }
          ).populate('usuario_id', 'nome'); // Popula o nome do cliente para a notificação


          if (!servico) {
               console.warn(`[BACKEND] Recusar Serviço: Serviço ${id} não encontrado, já aceito ou não está aguardando aceite para o prestador ${req.user.id}.`);
               return res.status(404).json({ message: 'Serviço não encontrado, já aceito ou não está aguardando aceite para você.' });
          }

          console.log(`[BACKEND] Serviço ${id} recusado com sucesso.`);

          // --- Criar Notificação para o Cliente ---
          if (servico.usuario_id) {
              await createNotification(
                  servico.usuario_id._id,
                  'usuario',
                  'solicitation_rejected',
                  `Sua solicitação de ${servico.tipo_servico} foi recusada.`,
                  `O prestador recusou sua solicitação de ${servico.tipo_servico}.`,
                  servico._id,
                  'Servico'
              );
          }
          // --- Fim Criar Notificação ---

          res.status(200).json({ message: 'Serviço recusado com sucesso!', servico });

     } catch (error) {
          console.error('[BACKEND] Erro ao recusar serviço:', error);
          res.status(500).json({ message: 'Erro no servidor ao recusar serviço.' });
     }
});


// Prestador Marca um serviço ACEITO (em andamento) como Concluído E FAZ UPLOAD DE COMPROVANTES (MODIFICADA para criar notificação para o cliente)
app.post('/concluir-servico/:id', authMiddlewarePrestador, uploadServiceComprovations, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição POST /concluir-servico/${req.params.id}`);
    const { id } = req.params;
    const arquivos = req.files;

    if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] Concluir Serviço: ID inválido recebido: ${id}`);
          if (arquivos && arquivos.length > 0) {
               arquivos.forEach(file => {
                    const filePath = path.join(__dirname, file.path);
                    fs.unlink(filePath, (err) => {
                       if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, err);
                    });
               });
          }
        return res.status(400).json({ message: 'ID inválido.' });
    }

    try {
        const servico = await Servico.findOneAndUpdate(
            { _id: id, prestador_id: req.user.id, status: 'aceito_pelo_prestador' },
            { status: 'concluido_pelo_prestador', data_conclusao: new Date() },
            { new: true }
        ).populate('usuario_id', 'nome'); // Popula o nome do cliente para a notificação


        if (!servico) {
             console.warn(`[BACKEND] Concluir Serviço: Serviço ${id} não encontrado ou não pode ser marcado como concluído pelo prestador ${req.user.id} (status inválido).`);
             if (arquivos && arquivos.length > 0) {
                  arquivos.forEach(file => {
                       const filePath = path.join(__dirname, file.path);
                       fs.unlink(filePath, (err) => {
                          if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, err);
                       });
                  });
             }
            return res.status(404).json({ message: 'Serviço não encontrado ou não pode ser marcado como concluído por você neste momento (status inválido).' });
        }

        console.log(`[BACKEND] Serviço ${id} marcado como concluído. Salvando comprovante(s)...`);

        if (arquivos && arquivos.length > 0) {
            for (const arquivo of arquivos) {
                const novaComprovacao = new ComprovacaoServico({
                    pedido_servico_id: servico._id,
                    caminho_arquivo: arquivo.path,
                    nome_arquivo_original: arquivo.originalname
                });
                await novaComprovacao.save();
                console.log(`[BACKEND] Comprovante salvo: ${arquivo.path}`);
            }
        } else {
             console.log("[BACKEND] Nenhum comprovante enviado.");
        }

        // --- Criar Notificação para o Cliente ---
        if (servico.usuario_id) {
            await createNotification(
                servico.usuario_id._id,
                'usuario',
                'service_concluded',
                `Serviço de ${servico.tipo_servico} concluído!`,
                `O prestador marcou o serviço de ${servico.tipo_servico} como concluído. Por favor, verifique e avalie o serviço.`,
                servico._id,
                'Servico'
            );
        }
        // --- Fim Criar Notificação ---

        res.status(200).json({ message: 'Serviço marcado como concluído e comprovação(ões) salva(s) com sucesso!', servico });

    } catch (error) {
        console.error('[BACKEND] Erro ao marcar serviço como concluído ou salvar comprovantes:', error);
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const filePath = path.join(__dirname, file.path);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, err);
                });
            });
        }
        next(error);
    }
});


// Rota para o Cliente enviar a Avaliação (MODIFICADA para criar notificação para o prestador)
app.post('/avaliar-servico/:id', authMiddlewareUsuario, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição POST /avaliar-servico/${req.params.id}`);
    const { id } = req.params;
    const { nota, comentario } = req.body;

    const { error } = validateAvaliacao(req.body);
    if (error) {
        console.error("[BACKEND] Erro de validação Joi na avaliação:", error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.warn(`[BACKEND] Avaliar Serviço: ID inválido recebido: ${id}`);
        return res.status(400).json({ message: 'ID do serviço inválido.' });
    }

    try {
        const servico = await Servico.findOne({
            _id: id,
            usuario_id: req.user.id,
            status: 'concluido_pelo_prestador'
        }).populate('prestador_id', 'nome'); // Popula o nome do prestador para a notificação

        if (!servico) {
            console.warn(`[BACKEND] Avaliar Serviço: Serviço ${id} não encontrado ou não pode ser avaliado pelo usuário ${req.user.id} no momento (status inválido).`);
            return res.status(404).json({ message: 'Serviço não encontrado ou não pode ser avaliado por você no momento (status inválido).' });
        }

        const avaliacaoExistente = await Avaliacao.findOne({ pedido_servico_id: id });
        if (avaliacaoExistente) {
            console.warn(`[BACKEND] Avaliar Serviço: Serviço ${id} já foi avaliado.`);
            return res.status(409).json({ message: 'Este serviço já foi avaliado.' });
        }

        const novaAvaliacao = new Avaliacao({
            pedido_servico_id: servico._id,
            cliente_id: req.user.id,
            prestador_id: servico.prestador_id,
            nota: parseInt(nota),
            comentario: comentario
        });
        await novaAvaliacao.save();
        console.log(`[BACKEND] Avaliação salva para o serviço ${id}.`);

        servico.status = 'avaliado_pelo_cliente';
        await servico.save();
        console.log(`[BACKEND] Status do serviço ${id} atualizado para 'avaliado_pelo_cliente'.`);

        // --- Criar Notificação para o Prestador ---
        if (servico.prestador_id) {
            await createNotification(
                servico.prestador_id._id,
                'prestador',
                'new_review',
                `Nova avaliação recebida para o serviço de ${servico.tipo_servico}!`,
                `Você recebeu uma nova avaliação (${nota} estrelas) para o serviço de ${servico.tipo_servico}.`,
                servico._id, // Referencia o serviço avaliado
                'Servico'
            );
        }
        // --- Fim Criar Notificação ---


        res.status(200).json({ message: 'Avaliação enviada com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] Erro ao enviar avaliação:', error);
        next(error);
    }
});


// Rota para o Cliente ou Prestador ver os detalhes de um serviço (Pedido do Cliente)
app.get('/servico/:id', authMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição GET /servico/${req.params.id}`);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.warn(`[BACKEND] Detalhes Serviço: ID inválido recebido: ${id}`);
        return res.status(400).json({ message: 'ID do serviço inválido.' });
    }

    try {
        // Popula dados básicos do cliente, prestador e do serviço oferecido associado
        const servico = await Servico.findById(id)
            .populate('usuario_id', 'nome email')
            .populate('prestador_id', 'nome email')
            .populate('servico_oferecido_id', 'nome descricao faixa_preco_min faixa_preco_max'); // Popula o serviço oferecido

        if (!servico) {
            console.warn(`[BACKEND] Detalhes Serviço: Serviço com ID ${id} não encontrado.`);
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        // Lógica de Autorização:
        const isClient = req.user.tipo === 'usuario' && servico.usuario_id && servico.usuario_id._id.toString() === req.user.id;
        const isPrestadorAtribuido = req.user.tipo === 'prestador' && servico.prestador_id && servico.prestador_id._id.toString() === req.user.id;

        // Adicionado: Verifica se é um prestador vendo uma solicitação pendente (sem prestador atribuído ainda)
        // Esta lógica pode precisar ser ajustada dependendo de como você lida com prestadores "pegando" solicitações
        // A lógica atual de /solicitacoes-servicos-pendentes já filtra por prestador_id
        // Então, para ver detalhes, o prestador já deve estar associado
        // Removendo a condição isViewingPendingSolicitation para simplificar, assumindo que só vê detalhes quem já está associado
        // const isViewingPendingSolicitation = req.user.tipo === 'prestador' && servico.status === 'aguardando_aceite_prestador' && !servico.prestador_id;


        if (!isClient && !isPrestadorAtribuido) {
             console.warn(`[BACKEND] Detalhes Serviço: Usuário ${req.user.id} (${req.user.tipo}) tentou acessar detalhes do serviço ${id} sem permissão.`);
             return res.status(403).json({ message: 'Você não tem permissão para ver os detalhes deste serviço.' });
        }

        console.log(`[BACKEND] Buscando comprovantes para o serviço ${id}.`);
        // Busca as comprovações associadas a este serviço
        const comprovacoes = await ComprovacaoServico.find({ pedido_servico_id: id });
        console.log(`[BACKEND] Encontrados ${comprovacoes.length} comprovante(s).`);

        console.log(`[BACKEND] Buscando avaliação para o serviço ${id}.`);
        // Busca a avaliação associada a este serviço (se existir)
        const avaliacao = await Avaliacao.findOne({ pedido_servico_id: id });
         if(avaliacao) console.log("[BACKEND] Avaliação encontrada.");


        const responseData = {
            ...servico.toObject(),
            nome_cliente: servico.usuario_id ? servico.usuario_id.nome : 'Cliente Desconhecido',
            nome_prestador: servico.prestador_id ? servico.prestador_id.nome : 'Prestador Não Atribuído',
            // Inclui detalhes do serviço oferecido associado, se existir
            detalhes_servico_oferecido: servico.servico_oferecido_id ? {
                 _id: servico.servico_oferecido_id._id,
                 nome: servico.servico_oferecido_id.nome,
                 descricao: servico.servico_oferecido_id.descricao,
                 faixa_preco_min: servico.servico_oferecido_id.faixa_preco_min,
                 faixa_preco_max: servico.servico_oferecido_id.faixa_preco_max,
            } : null,
            comprovantes_url: comprovacoes.map(comp =>
                 `${BACKEND_BASE_URL}/${comp.caminho_arquivo.replace(/\\/g, '/')}`
            ),
            avaliacao_cliente: avaliacao ? avaliacao.nota : null,
            comentario_cliente: avaliacao ? avaliacao.comentario : null,
        };

        if (servico.status === 'aguardando_pagamento_cliente' && servico.payment_link) {
             responseData.payment_link = servico.payment_link;
        }

        console.log(`[BACKEND] Enviando detalhes do serviço ${id}.`);
        res.status(200).json(responseData);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar detalhes do serviço:', error);
        next(error);
    }
});


// Deletar serviço (quem pode deletar?)
app.delete('/deletar-servico/:id', authMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /deletar-servico/${req.params.id}`);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Deletar Serviço: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID inválido.' });
        }

        const servicoToDelete = await Servico.findById(id);

         if (!servicoToDelete) {
              console.warn(`[BACKEND] Deletar Serviço: Serviço com ID ${id} não encontrado.`);
              return res.status(404).json({ message: 'Serviço não encontrado.' });
         }

         // Apenas o cliente que criou o serviço pode deletar, e apenas se o status permitir
         const isAuthorizedClient = req.user.tipo === 'usuario' &&
                                    servicoToDelete.usuario_id.toString() === req.user.id &&
                                    ['aguardando_aceite_prestador', 'aguardando_pagamento_cliente', 'recusado_pelo_prestador', 'cancelado'].includes(servicoToDelete.status);

         // --- ADMIN PODE DELETAR QUALQUER SERVIÇO ---
         const isAdmin = req.user.tipo === 'usuario' && (await Usuario.findById(req.user.id).select('isAdmin'))?.isAdmin;

         if (!isAuthorizedClient && !isAdmin) {
             console.warn(`[BACKEND] Deletar Serviço: Usuário ${req.user.id} (${req.user.tipo}) tentou deletar serviço ${id} sem permissão ou status inválido (${servicoToDelete.status}).`);
             return res.status(403).json({ message: 'Você não tem permissão para deletar este serviço ou o status não permite.' });
         }

        console.log(`[BACKEND] Deletando avaliações, comprovantes e mensagens associadas ao serviço ${id}.`);
        // Deleta notificações relacionadas a este serviço
        await Notification.deleteMany({ referenciaId: id, referenciaModel: 'Servico' });
        await Avaliacao.deleteMany({ pedido_servico_id: id });
        const comprovacoes = await ComprovacaoServico.find({ pedido_servico_id: id });
        comprovacoes.forEach(comp => {
            const filePath = path.join(__dirname, comp.caminho_arquivo);
            if (fs.existsSync(filePath)) {
                 fs.unlink(filePath, (err) => {
                     if (err) console.error(`[BACKEND] Erro ao excluir arquivo ${filePath}:`, err);
                 });
            } else {
                 console.warn(`[BACKEND] Arquivo não encontrado para exclusão: ${filePath}`);
            }
        });
        await ComprovacaoServico.deleteMany({ pedido_servico_id: id });

        await Message.deleteMany({ service_id: id });
        console.log(`[BACKEND] Deletando o serviço ${id}.`);

        const servicoDeletado = await Servico.findByIdAndDelete(id);

        console.log(`[BACKEND] Serviço ${id} deletado com sucesso.`);
        res.status(200).json({ message: 'Serviço deletado com sucesso!' });
    } catch (error) {
        console.error('[BACKEND] Erro ao deletar serviço:', error);
        next(error);
    }
});

// Cadastro de Usuário (Cliente)
app.post('/cadastrar', uploadProfilePicture, async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /cadastrar');
    const { nome, telefone, email, senha } = req.body;
    const fotoPerfil = req.file;

    const { error, value } = validateCadastroUsuario({ nome, telefone, email, senha });
    if (error) {
        console.error("[BACKEND] Erro de validação Joi no cadastro de usuário:", error.details);
        if (fotoPerfil) {
            const filePath = path.join(__dirname, fotoPerfil.path);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
            });
        }
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const usuarioExistente = await Usuario.findOne({ email: value.email });
        if (usuarioExistente) {
             console.warn(`[BACKEND] Tentativa de cadastrar usuário com email duplicado: ${value.email}`);
             if (fotoPerfil) {
                  const filePath = path.join(__dirname, fotoPerfil.path);
                  fs.unlink(filePath, (err) => {
                     if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após email duplicado:`, err);
                  });
             }
            return res.status(400).json({ message: 'Email já cadastrado como usuário.' });
        }

        const senhaHash = await bcrypt.hash(value.senha, 10);
        const novoUsuario = new Usuario({
            nome: value.nome,
            email: value.email,
            senha: senhaHash,
            telefone: value.telefone,
            foto_perfil: fotoPerfil ? fotoPerfil.path : null,
             isAdmin: false // Novos usuários cadastrados pela rota pública NÃO são admin por padrão
        });
        await novoUsuario.save();

        console.log(`[BACKEND] Usuário cadastrado com sucesso: ${novoUsuario.email}`);
        res.status(201).json({ message: 'Cadastro de usuário realizado com sucesso! Faça login.' });
    } catch (error) {
        console.error('[BACKEND] Erro ao cadastrar usuário:', error);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro no banco de dados:`, err);
              });
         }
        if (error.code === 11000) {
             return res.status(400).json({ message: 'Email já cadastrado.' });
        }
        next(error);
    }
});

// Cadastro de Prestador
app.post('/cadastrar-prestador', uploadProfilePicture, async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /cadastrar-prestador');
    const { nome, telefone, email, senha } = req.body;
    const fotoPerfil = req.file;

    const { error, value } = validateCadastroPrestador({ nome, telefone, email, senha });
    if (error) {
        console.error("[BACKEND] Erro de validação Joi no cadastro de prestador:", error.details);
        if (fotoPerfil) {
            const filePath = path.join(__dirname, fotoPerfil.path);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
            });
        }
        return res.status(400).json({ message: error.details[0].message });
    }

     try {
          const prestadorExistente = await Prestador.findOne({ email: value.email });
          if (prestadorExistente) {
               console.warn(`[BACKEND] Tentativa de cadastrar prestador com email duplicado: ${value.email}`);
               if (fotoPerfil) {
                    const filePath = path.join(__dirname, fotoPerfil.path);
                    fs.unlink(filePath, (err) => {
                       if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após email duplicado:`, err);
                    });
               }
               return res.status(400).json({ message: 'Email já cadastrado como prestador.' });
          }

          const senhaHash = await bcrypt.hash(value.senha, 10);
          const novoPrestador = new Prestador({
               nome: value.nome,
               email: value.email,
               senha: senhaHash,
               telefone: value.telefone,
               foto_perfil: fotoPerfil ? fotoPerfil.path : null
            });
          await novoPrestador.save();

          console.log(`[BACKEND] Prestador cadastrado com sucesso: ${novoPrestador.email}`);
          res.status(201).json({ message: 'Cadastro de prestador realizado com sucesso! Faça login.' });
     } catch (error) {
          console.error('[BACKEND] Erro ao cadastrar prestador:', error);
          if (fotoPerfil) {
               const filePath = path.join(__dirname, fotoPerfil.path);
               fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro no banco de dados:`, err);
               });
          }
           if (error.code === 11000) {
                return res.status(400).json({ message: 'Email já cadastrado.' });
           }
          next(error);
     }
});


// Login de Usuário (Cliente)
app.post('/login', async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /login');
    const { email, senha } = req.body;

    if (!email || !senha) {
        console.warn('[BACKEND] Login Usuário: Email ou senha ausentes.');
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            console.warn(`[BACKEND] Login Usuário: Usuário com email ${email} não encontrado.`);
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            console.warn(`[BACKEND] Login Usuário: Senha incorreta para o email ${email}.`);
            return res.status(401).json({ message: 'Senha incorreta.' });
        }

        // Inclui o status de admin no token
        const token = jwt.sign({ id: usuario._id, tipo: 'usuario', isAdmin: usuario.isAdmin }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1d' });

        console.log(`[BACKEND] Login de usuário bem-sucedido para: ${email} (Admin: ${usuario.isAdmin})`);
        res.status(200).json({
            message: 'Login realizado com sucesso!',
            token,
            usuario: {
                 _id: usuario._id,
                 nome: usuario.nome,
                 email: usuario.email,
                 telefone: usuario.telefone, // Incluído telefone
                 // Usa BACKEND_BASE_URL para construir a URL completa da foto
                 foto_perfil_url: usuario.foto_perfil ? `${BACKEND_BASE_URL}/${usuario.foto_perfil.replace(/\\/g, '/')}` : null,
                 isAdmin: usuario.isAdmin // Inclui o status de admin na resposta
            }
        });
    } catch (error) {
        console.error('[BACKEND] Erro no login de usuário:', error);
        next(error);
    }
});

// Login de Prestador
app.post('/login-prestador', async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /login-prestador');
    const { email, senha } = req.body;

    if (!email || !senha) {
        console.warn('[BACKEND] Login Prestador: Email ou senha ausentes.');
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        const prestador = await Prestador.findOne({ email });
        if (!prestador) {
            console.warn(`[BACKEND] Login Prestador: Prestador com email ${email} não encontrado.`);
            return res.status(404).json({ message: 'Prestador não encontrado.' });
        }

        const senhaValida = await bcrypt.compare(senha, prestador.senha);
        if (!senhaValida) {
            console.warn(`[BACKEND] Login Prestador: Senha incorreta para o email ${email}.`);
            return res.status(401).json({ message: 'Senha incorreta.' });
        }

        const token = jwt.sign({ id: prestador._id, tipo: 'prestador' }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1d' });

        console.log(`[BACKEND] Login de prestador bem-sucedido para: ${email}`);
        res.status(200).json({
            message: 'Login realizado com sucesso!',
            token,
            prestador: {
                 _id: prestador._id,
                 nome: prestador.nome,
                 email: prestador.email,
                 telefone: prestador.telefone, // Incluído telefone
                 especialidades: prestador.especialidades, // Incluído especialidades
                 area_atuacao: prestador.area_atuacao, // Incluído area_atuacao
                 disponibilidade: prestador.disponibilidade, // Incluído disponibilidade
                 // Usa BACKEND_BASE_URL para construir a URL completa da foto
                 foto_perfil_url: prestador.foto_perfil ? `${BACKEND_BASE_URL}/${prestador.foto_perfil.replace(/\\/g, '/')}` : null
            }
        });
    } catch (error) {
        console.error('[BACKEND] Erro no login de prestador:', error);
        next(error);
    }
});


// Perfil do Usuário/Prestador logado (MODIFICADA para incluir isAdmin)
app.get('/perfil', authMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição GET /perfil para usuário ${req.user.id} (${req.user.tipo})`);
    try {
        if (req.user.tipo === 'usuario') {
            const usuario = await Usuario.findById(req.user.id).select('_id nome email telefone foto_perfil isAdmin'); // Adicionado isAdmin
            if (!usuario) {
                 console.warn(`[BACKEND] Perfil: Usuário ${req.user.id} não encontrado.`);
                 return res.status(404).json({ message: 'Usuário não encontrado.' });
            }
             // Usa BACKEND_BASE_URL para construir a URL completa da foto
             const fotoPerfilUrl = usuario.foto_perfil ? `${BACKEND_BASE_URL}/${usuario.foto_perfil.replace(/\\/g, '/')}` : null;
            res.status(200).json({ usuario: { ...usuario.toObject(), foto_perfil_url: fotoPerfilUrl }, tipo: 'usuario' });
        } else if (req.user.tipo === 'prestador') {
             const prestador = await Prestador.findById(req.user.id).select('_id nome email telefone foto_perfil especialidades area_atuacao disponibilidade'); // Adicionado campos específicos do prestador
             if (!prestador) {
                  console.warn(`[BACKEND] Perfil: Prestador ${req.user.id} não encontrado.`);
                  return res.status(404).json({ message: 'Prestador não encontrado.' });
             }
             // Usa BACKEND_BASE_URL para construir a URL completa da foto
             const fotoPerfilUrl = prestador.foto_perfil ? `${BACKEND_BASE_URL}/${prestador.foto_perfil.replace(/\\/g, '/')}` : null;
             res.status(200).json({ prestador: { ...prestador.toObject(), foto_perfil_url: fotoPerfilUrl }, tipo: 'prestador' });
        } else {
            console.warn(`[BACKEND] Perfil: Tipo de usuário no token desconhecido: ${req.user.tipo}`);
            return res.status(400).json({ message: 'Tipo de usuário no token desconhecido.' });
        }

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar perfil:', error);
        next(error);
    }
});

// --- NOVA ROTA: Atualizar perfil do USUÁRIO (CLIENTE) logado ---
app.put('/perfil-usuario', authMiddlewareUsuario, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /perfil-usuario para usuário ${req.user.id}`);
    const { nome, telefone } = req.body;

    const { error, value } = validateUsuarioUpdate(req.body);
    if (error) {
        console.error("[BACKEND] Erro de validação Joi na atualização do perfil do usuário:", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const usuario = await Usuario.findById(req.user.id);
        if (!usuario) {
            console.warn(`[BACKEND] Perfil Usuário: Usuário ${req.user.id} não encontrado para atualização.`);
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Atualiza os campos permitidos
        if (value.nome !== undefined) usuario.nome = value.nome;
        if (value.telefone !== undefined) usuario.telefone = value.telefone;

        await usuario.save();

        // Retorna o objeto de usuário atualizado, incluindo a URL da foto de perfil
        const fotoPerfilUrl = usuario.foto_perfil ? `${BACKEND_BASE_URL}/${usuario.foto_perfil.replace(/\\/g, '/')}` : null;
        const updatedUser = { ...usuario.toObject(), foto_perfil_url: fotoPerfilUrl };
        delete updatedUser.senha; // Não retorna a senha

        console.log(`[BACKEND] Perfil do usuário ${req.user.id} atualizado com sucesso.`);
        res.status(200).json({ message: 'Perfil atualizado com sucesso!', usuario: updatedUser });

    } catch (error) {
        console.error('[BACKEND] Erro ao atualizar perfil do usuário:', error);
        next(error);
    }
});

// --- NOVA ROTA: Atualizar perfil do PRESTADOR logado ---
app.put('/perfil-prestador', authMiddlewarePrestador, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /perfil-prestador para prestador ${req.user.id}`);
    const { nome, telefone, especialidades, area_atuacao, disponibilidade } = req.body;

    const { error, value } = validatePrestadorUpdate(req.body);
    if (error) {
        console.error("[BACKEND] Erro de validação Joi na atualização do perfil do prestador:", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const prestador = await Prestador.findById(req.user.id);
        if (!prestador) {
            console.warn(`[BACKEND] Perfil Prestador: Prestador ${req.user.id} não encontrado para atualização.`);
            return res.status(404).json({ message: 'Prestador não encontrado.' });
        }

        // Atualiza os campos permitidos
        if (value.nome !== undefined) prestador.nome = value.nome;
        if (value.telefone !== undefined) prestador.telefone = value.telefone;
        if (value.especialidades !== undefined) prestador.especialidades = value.especialidades;
        if (value.area_atuacao !== undefined) prestador.area_atuacao = value.area_atuacao;
        if (value.disponibilidade !== undefined) prestador.disponibilidade = value.disponibilidade;

        await prestador.save();

        // Retorna o objeto de prestador atualizado, incluindo a URL da foto de perfil
        const fotoPerfilUrl = prestador.foto_perfil ? `${BACKEND_BASE_URL}/${prestador.foto_perfil.replace(/\\/g, '/')}` : null;
        const updatedPrestador = { ...prestador.toObject(), foto_perfil_url: fotoPerfilUrl };
        delete updatedPrestador.senha; // Não retorna a senha

        console.log(`[BACKEND] Perfil do prestador ${req.user.id} atualizado com sucesso.`);
        res.status(200).json({ message: 'Perfil atualizado com sucesso!', prestador: updatedPrestador });

    } catch (error) {
        console.error('[BACKEND] Erro ao atualizar perfil do prestador:', error);
        next(error);
    }
});
// --- FIM NOVAS ROTAS DE ATUALIZAÇÃO DE PERFIL ---


// Endpoint para upload de foto de perfil (para usuário e prestador)
app.post('/upload-foto-perfil', authMiddleware, uploadProfilePicture, async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /upload-foto-perfil');
    const fotoPerfil = req.file;

    if (!fotoPerfil) {
        console.warn('[BACKEND] Upload Foto Perfil: Nenhum arquivo de foto enviado.');
        return res.status(400).json({ message: 'Nenhum arquivo de foto enviado.' });
    }

    try {
        let userModel;
        if (req.user.tipo === 'usuario') {
            userModel = Usuario;
        } else if (req.user.tipo === 'prestador') {
            userModel = Prestador;
        } else {
            console.warn(`[BACKEND] Upload Foto Perfil: Tipo de usuário no token desconhecido: ${req.user.tipo}`);
            // Exclui o arquivo temporário
            const filePath = path.join(__dirname, fotoPerfil.path);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, err);
            });
            return res.status(400).json({ message: 'Tipo de usuário não suportado para upload de foto de perfil.' });
        }

        const user = await userModel.findById(req.user.id);
        if (!user) {
            console.warn(`[BACKEND] Upload Foto Perfil: Usuário/Prestador ${req.user.id} não encontrado.`);
            // Exclui o arquivo temporário
            const filePath = path.join(__dirname, fotoPerfil.path);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após usuário não encontrado:`, err);
            });
            return res.status(404).json({ message: 'Usuário ou Prestador não encontrado.' });
        }

        // Se já existe uma foto, tenta deletar a antiga
        if (user.foto_perfil) {
            const oldFilePath = path.join(__dirname, user.foto_perfil);
            if (fs.existsSync(oldFilePath)) {
                fs.unlink(oldFilePath, (err) => {
                    if (err) console.error(`[BACKEND] Erro ao excluir foto de perfil antiga ${oldFilePath}:`, err);
                });
            } else {
                console.warn(`[BACKEND] Foto de perfil antiga não encontrada para exclusão: ${oldFilePath}`);
            }
        }

        user.foto_perfil = fotoPerfil.path; // Salva o novo caminho no banco de dados
        await user.save();

        // Constrói a URL completa da nova foto
        const newPhotoUrl = `${BACKEND_BASE_URL}/${fotoPerfil.path.replace(/\\/g, '/')}`;

        console.log(`[BACKEND] Foto de perfil atualizada com sucesso para ${user.email}. Nova URL: ${newPhotoUrl}`);
        res.status(200).json({ message: 'Foto de perfil atualizada com sucesso!', foto_perfil_url: newPhotoUrl });

    } catch (error) {
        console.error('[BACKEND] Erro ao fazer upload da foto de perfil:', error);
        // Em caso de erro, tenta excluir o arquivo temporário
        if (fotoPerfil) {
            const filePath = path.join(__dirname, fotoPerfil.path);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, err);
            });
        }
        next(error);
    }
});


// Quantidade de pedidos por usuário (agora protegida)
app.get("/api/pedidos/quantidade", authMiddlewareUsuario, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /api/pedidos/quantidade para usuário: ${req.user.id}`);
        const totalPedidos = await Servico.countDocuments({ usuario_id: req.user.id });
        console.log(`[BACKEND] Total de pedidos encontrados para o usuário: ${totalPedidos}`);
        res.json({ total: totalPedidos });
    } catch (err) {
        console.error("[BACKEND] Erro ao buscar a quantidade de pedidos:", err);
        next(err);
    }
});


// Endpoint para listar serviços concluídos do usuário cliente logado que precisam de avaliação
app.get('/pedidos-para-avaliar', authMiddlewareUsuario, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /pedidos-para-avaliar para usuário: ${req.user.id}`);
        const usuarioId = req.user.id;

        const avaliacoesExistentes = await Avaliacao.find({ cliente_id: usuarioId }).select('pedido_servico_id');
        const pedidosAvaliadosIds = avaliacoesExistentes.map(avaliacao => avaliacao.pedido_servico_id);

        const pedidosParaAvaliar = await Servico.find({
            usuario_id: usuarioId,
            status: 'concluido_pelo_prestador',
            _id: { $nin: pedidosAvaliadosIds }
        })
        .select('_id descricao_servico prestador_id tipo_servico') // Inclui tipo_servico
        .populate('prestador_id', 'nome');

        const responseData = pedidosParaAvaliar.map(pedido => ({
            _id: pedido._id,
            titulo: pedido.tipo_servico || pedido.descricao_servico || `Serviço Concluído (ID: ${pedido._id.toString().substring(0, 6)})`, // Usa tipo_servico ou descrição
            prestadorId: pedido.prestador_id ? pedido.prestador_id._id : null,
            prestadorNome: pedido.prestador_id ? pedido.prestador_id.nome : 'Prestador não informado'
        }));

        console.log(`[BACKEND] Encontrados ${responseData.length} pedidos para avaliar para o usuário.`);
        res.status(200).json(responseData);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar pedidos para avaliar:', error);
        next(error);
    }
});


// --- ROTAS PARA CHAT ---
// Rota para listar mensagens de um serviço específico
app.get('/chat/:serviceId/messages', authMiddleware, isServiceParticipant, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição GET /chat/${req.params.serviceId}/messages`);
    const { serviceId } = req.params;
    const userId = req.user.id; // ID do usuário/prestador logado

    try {
        const messages = await Message.find({ service_id: serviceId }).sort('data_envio');
        console.log(`[BACKEND] Encontradas ${messages.length} mensagens para o serviço ${serviceId}.`);

        // Marca as mensagens recebidas (que não foram enviadas pelo usuário logado) como lidas
        const unreadMessagesForUser = messages.filter(msg =>
            msg.remetente_id.toString() !== userId && !msg.lido_por.includes(userId)
        );

        if (unreadMessagesForUser.length > 0) {
            const unreadMessageIds = unreadMessagesForUser.map(msg => msg._id);
            await Message.updateMany(
                { _id: { $in: unreadMessageIds } },
                { $addToSet: { lido_por: userId } } // Adiciona o ID do usuário ao array lido_por
            );
             console.log(`[BACKEND] Marcadas ${unreadMessagesForUser.length} mensagens como lidas para o usuário ${userId} no serviço ${serviceId}.`);
        }

        res.status(200).json(messages);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar mensagens do chat:', error);
        next(error);
    }
});

// Rota para enviar uma nova mensagem (MODIFICADA para criar notificação para o outro participante)
app.post('/chat/message', authMiddleware, isServiceParticipant, async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /chat/message');
    const { serviceId, conteudo } = req.body;
    const userId = req.user.id; // ID do remetente
    const userType = req.user.tipo; // Tipo do remetente
    const servico = req.servico; // Serviço populado pelo middleware isServiceParticipant

    const { error } = validateMessage(req.body);
    if (error) {
        console.error("[BACKEND] Erro de validação Joi na mensagem:", error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        let remetenteNome = 'Desconhecido';
        if (userType === 'usuario') {
            const usuario = await Usuario.findById(userId).select('nome');
            if (usuario) remetenteNome = usuario.nome;
        } else if (userType === 'prestador') {
             const prestador = await Prestador.findById(userId).select('nome');
             if (prestador) remetenteNome = prestador.nome;
        }


        const novaMensagem = new Message({
            service_id: serviceId,
            remetente_id: userId,
            remetente_tipo: userType,
            remetente_nome_cache: remetenteNome,
            conteudo: conteudo,
            data_envio: new Date(),
            lido_por: [userId] // O remetente já leu a mensagem que enviou
        });

        await novaMensagem.save();
        console.log(`[BACKEND] Nova mensagem salva para o serviço ${serviceId}.`);

        // --- Criar Notificação para o Outro Participante ---
        let recipientId = null;
        let recipientType = null;
        let summary = `Nova mensagem no chat do serviço de ${servico.tipo_servico}`;

        if (userType === 'usuario' && servico.prestador_id) {
             recipientId = servico.prestador_id._id;
             recipientType = 'prestador';
             summary = `Nova mensagem de ${remetenteNome} no chat do serviço de ${servico.tipo_servico}`;
        } else if (userType === 'prestador' && servico.usuario_id) {
             recipientId = servico.usuario_id._id;
             recipientType = 'usuario';
             summary = `Nova mensagem de ${remetenteNome} no chat do serviço de ${servico.tipo_servico}`;
        }

        if (recipientId && recipientType) {
             await createNotification(
                 recipientId,
                 recipientType,
                 'new_message',
                 summary,
                 conteudo.substring(0, 100) + (conteudo.length > 100 ? '...' : ''), // Prévia da mensagem
                 serviceId,
                 'Servico' // Referencia o serviço (chat room)
             );
        }
        // --- Fim Criar Notificação ---


        res.status(201).json({ message: 'Mensagem enviada com sucesso!', mensagem: novaMensagem });

    } catch (error) {
        console.error('[BACKEND] Erro ao enviar mensagem:', error);
        next(error);
    }
});

// Endpoint para contar mensagens não lidas para o usuário logado (AGORA NÃO USADO PARA O SINO, APENAS PARA INDICADOR NA SIDEBAR SE NECESSÁRIO)
// O sino usa o endpoint /api/notifications/prestador
app.get('/api/chat/unread-count', authMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição GET /api/chat/unread-count para usuário: ${req.user.id}`);
    const userId = req.user.id;

    try {
        const unreadCount = await Message.countDocuments({
            remetente_id: { $ne: userId },
            lido_por: { $nin: [userId] }
        });

        console.log(`[BACKEND] Total de mensagens não lidas para o usuário ${userId}: ${unreadCount}`);
        res.status(200).json({ total: unreadCount });

    } catch (error) {
        console.error('[BACKEND] Erro ao contar mensagens não lidas:', error);
        next(error);
    }
});


// --- NOVOS ENDPOINTS PARA NOTIFICAÇÕES ---

// Rota para listar notificações do usuário/prestador logado
app.get('/api/notifications/:userType', authMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição GET /api/notifications/${req.params.userType} para usuário: ${req.user.id}`);
    const { userType } = req.params; // 'usuario' ou 'prestador'

    // Garante que o userType na URL corresponde ao tipo do usuário logado
    if (req.user.tipo !== userType) {
        console.warn(`[BACKEND] Notificações: Usuário ${req.user.id} (${req.user.tipo}) tentou acessar notificações de tipo ${userType}.`);
        return res.status(403).json({ message: 'Você não tem permissão para acessar este tipo de notificação.' });
    }

    try {
        // Busca as notificações para o usuário logado, ordenadas pela mais recente
        const notifications = await Notification.find({
            recipient_id: req.user.id,
            recipient_type: userType
        })
        .sort({ timestamp: -1 }) // Ordena do mais novo para o mais antigo
        .limit(20); // Limita para não carregar muitas notificações de uma vez

        console.log(`[BACKEND] Encontradas ${notifications.length} notificações para o ${userType} ${req.user.id}.`);
        res.status(200).json(notifications);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar notificações:', error);
        next(error);
    }
});

// Rota para marcar uma notificação como lida
app.put('/api/notifications/:id/mark-as-read', authMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /api/notifications/${req.params.id}/mark-as-read para usuário: ${req.user.id}`);
    const { id } = req.params; // ID da notificação

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.warn(`[BACKEND] Marcar Notificação Lida: ID inválido recebido: ${id}`);
        return res.status(400).json({ message: 'ID da notificação inválido.' });
    }

    try {
        // Encontra a notificação e verifica se o usuário logado é o destinatário
        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient_id: req.user.id },
            { lida: true },
            { new: true }
        );

        if (!notification) {
            console.warn(`[BACKEND] Marcar Notificação Lida: Notificação ${id} não encontrada para o usuário ${req.user.id} ou já estava marcada como lida.`);
            // Retorna 404 se não encontrar ou se não for o destinatário correto
            return res.status(404).json({ message: 'Notificação não encontrada ou você não tem permissão.' });
        }

        console.log(`[BACKEND] Notificação ${id} marcada como lida para o usuário ${req.user.id}.`);
        res.status(200).json({ message: 'Notificação marcada como lida.', notification });

    } catch (error) {
        console.error('[BACKEND] Erro ao marcar notificação como lida:', error);
        next(error);
    }
});

// --- FIM NOVOS ENDPOINTS PARA NOTIFICAÇÕES ---

// --- NOVOS ENDPOINTS PARA INTEGRAÇÃO COM GEMINI API ---

// Endpoint para o chatbot principal
// REMOVIDO: authMiddlewareUsuarioOuPrestador para permitir acesso sem autenticação
app.post('/api/chat', async (req, res) => {
    console.log('[BACKEND] Recebida requisição POST /api/chat');
    const { chatHistory } = req.body;

    if (!GEMINI_API_KEY || !genAI) {
        console.error("[BACKEND] Erro: GEMINI_API_KEY não configurada no servidor.");
        return res.status(500).json({ message: "Erro na IA: Chave da API não configurada no servidor. Contate o suporte." });
    }

    if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
        return res.status(400).json({ message: "Histórico do chat inválido ou vazio." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent({ contents: chatHistory });
        const response = await result.response;
        const text = response.text();

        console.log("[BACKEND] Resposta do chatbot gerada pela IA com sucesso.");
        res.status(200).json({ aiResponse: text });

    } catch (error) {
        console.error("[BACKEND] Erro ao chamar Gemini API para o chatbot:", error);
        // Tente extrair uma mensagem de erro mais específica da API Gemini se disponível
        let errorMessage = "Erro ao processar sua mensagem com a IA. Tente novamente.";
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ message: errorMessage });
    }
});


// Endpoint para gerar descrição detalhada usando Gemini API
// ALTERADO: Agora permite acesso para 'usuario' e 'prestador'
app.post('/api/gemini/generate-description', authMiddlewareUsuarioOuPrestador, async (req, res) => {
    console.log('[BACKEND] Recebida requisição POST /api/gemini/generate-description');
    const { userInput } = req.body;

    if (!GEMINI_API_KEY || !genAI) {
        console.error("[BACKEND] Erro: GEMINI_API_KEY não configurada no servidor.");
        return res.status(500).json({ message: "Erro na IA: Chave da API não configurada no servidor. Contate o suporte." });
    }

    if (!userInput || userInput.length < 5) {
        return res.status(400).json({ message: "Por favor, forneça uma descrição mais detalhada para a IA." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        // PROMPT LAPIDADO: Mais conciso e focado na descrição do serviço
        const prompt = `Com base na seguinte solicitação do usuário, gere uma descrição concisa e detalhada do serviço que ele precisa. O tone deve ser profissional e informativo. Responda apenas com a descrição detalhada, focando no problema a ser resolvido e no resultado esperado, sem ser um manual de instruções para o prestador. Solicitação: "${userInput}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("[BACKEND] Descrição gerada pela IA com sucesso.");
        res.status(200).json({ generatedText: text });

    } catch (error) {
        console.error("[BACKEND] Erro ao chamar Gemini API para gerar descrição:", error);
        res.status(500).json({ message: "Erro ao gerar descrição detalhada com IA. Tente novamente." });
    }
});

// Endpoint para gerar recomendações personalizadas usando Gemini API
app.post('/api/gemini/recommendations', authMiddlewareUsuario, async (req, res) => {
    console.log('[BACKEND] Recebida requisição POST /api/gemini/recommendations');
    const { previousServiceNames, allServiceNames } = req.body;

    if (!GEMINI_API_KEY || !genAI) {
        console.error("[BACKEND] Erro: GEMINI_API_KEY não configurada no servidor.");
        return res.status(500).json({ message: "Erro na IA: Chave da API não configurada no servidor. Contate o suporte." });
    }

    if (!previousServiceNames || !allServiceNames) {
        return res.status(400).json({ message: "Dados insuficientes para gerar recomendações." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Dado o histórico de serviços que o usuário solicitou: "${previousServiceNames}", e a lista de todos os serviços disponíveis: "${allServiceNames}", sugira 3 a 5 novos serviços que o usuário possa ter interesse. Foque em serviços relacionados aos seus interesses passados ou serviços complementares. Forneça apenas os nomes dos serviços recomendados como um array JSON de strings.`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: { "type": "STRING" }
                }
            }
        };

        const result = await model.generateContent(payload);
        const response = await result.response;
        const jsonString = response.text();
        const recommendedNames = JSON.parse(jsonString);

        console.log("[BACKEND] Recomendações geradas pela IA com sucesso.");
        res.status(200).json({ recommendedNames: recommendedNames });

    } catch (error) {
        console.error("[BACKEND] Erro ao chamar Gemini API para recomendações:", error);
        res.status(500).json({ message: "Erro ao gerar recomendações com IA. Tente novamente." });
    }
});

// Endpoint para busca inteligente de serviços usando Gemini API
app.post('/api/gemini/smart-filter', authMiddlewareUsuario, async (req, res) => {
    console.log('[BACKEND] Recebida requisição POST /api/gemini/smart-filter');
    const { query } = req.body;

    if (!GEMINI_API_KEY || !genAI) {
        console.error("[BACKEND] Erro: GEMINI_API_KEY não configurada no servidor.");
        return res.status(500).json({ message: "Erro na IA: Chave da API não configurada no servidor. Contate o suporte." });
    }

    if (!query || query.length < 3) {
        return res.status(400).json({ message: "Consulta muito curta para busca inteligente." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Dada a consulta de busca do usuário, extraia nomes de serviços relevantes, categorias e nomes de prestadores. Responda no formato JSON com as chaves "service_names", "categories", "provider_names" como arrays de strings. Se nenhum termo específico for encontrado para uma chave, retorne um array vazio. Consulta: "${query}"`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "service_names": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "categories": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "provider_names": { "type": "ARRAY", "items": { "type": "STRING" } }
                    },
                    "propertyOrdering": ["service_names", "categories", "provider_names"]
                }
            }
        };

        const result = await model.generateContent(payload);
        const response = await result.response;
        const jsonString = response.text();
        const smartSuggestions = JSON.parse(jsonString);

        console.log("[BACKEND] Sugestões de filtro inteligente geradas pela IA com sucesso.");
        res.status(200).json({ smartSuggestions: smartSuggestions });

    } catch (error) {
        console.error("[BACKEND] Erro ao chamar Gemini API para busca inteligente:", error);
        res.status(500).json({ message: "Erro ao gerar sugestões de busca inteligente com IA. Tente novamente." });
    }
});

// --- FIM NOVOS ENDPOINTS PARA INTEGRAÇÃO COM GEMINI API ---


// --- Webhook do Mercado Pago ---
app.post('/mercadopago/webhook', async (req, res) => {
    console.log('[BACKEND] Webhook do Mercado Pago recebido:', req.query);

    if (req.query.topic === 'payment') {
        const paymentId = req.query.id;
        console.log('[BACKEND] Notificação de pagamento recebida. Payment ID:', paymentId);

        try {
            const paymentData = await payment.get({ id: paymentId });

            console.log('[BACKEND] Detalhes do pagamento do Mercado Pago:', paymentData);

            const serviceId = paymentData.external_reference;
            const paymentStatus = paymentData.status;

            console.log(`[BACKEND] Webhook: Payment Status: ${paymentStatus}, External Reference (Service ID): ${serviceId}`);

            if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
                 console.error('[BACKEND] Webhook: ID do serviço inválido ou ausente na referência externa.');
                 return res.status(400).send('ID do serviço inválido ou ausente.');
            }

            // Popula o prestador_id para criar a notificação
            const servico = await Servico.findById(serviceId).populate('prestador_id', 'nome');

            if (!servico) {
                console.error(`[BACKEND] Webhook: Serviço com ID ${serviceId} não encontrado.`);
                return res.status(404).send('Serviço não encontrado.');
            }

            let newStatus = servico.status;
            let notificationCreated = false; // Flag para evitar notificações duplicadas para o mesmo evento

            if (paymentStatus === 'approved') {
                if (servico.status === 'aguardando_pagamento_cliente' || servico.status === 'aguardando_confirmacao_pagamento') {
                     newStatus = 'aceito_pelo_prestador';
                     console.log(`[BACKEND] Webhook: Pagamento APROVADO para o serviço ${serviceId}. Status atualizado para '${newStatus}'.`);

                     // --- Criar Notificação para o Prestador (Pagamento Recebido) ---
                     if (servico.prestador_id) {
                         await createNotification(
                             servico.prestador_id._id,
                             'prestador',
                             'payment_received',
                             `Pagamento recebido para o serviço de ${servico.tipo_servico}!`,
                             `O pagamento de R$ ${servico.valor_servico.toFixed(2).replace('.', ',')} para o serviço de ${servico.tipo_servico} foi aprovado.`,
                             servico._id,
                             'Servico'
                         );
                         notificationCreated = true;
                     }
                     // --- Fim Criar Notificação ---

                } else {
                     console.warn(`[BACKEND] Webhook: Pagamento APROVADO para o serviço ${serviceId}, mas o status atual ('${servico.status}') não era o esperado para transição para 'aceito_pelo_prestador'.`);
                }
            } else if (paymentStatus === 'pending') {
                 if (servico.status === 'aguardando_pagamento_cliente') {
                      newStatus = 'aguardando_confirmacao_pagamento';
                      console.log(`[BACKEND] Webhook: Pagamento PENDENTE para o serviço ${serviceId}. Status atualizado para '${newStatus}'.`);
                 } else {
                      console.warn(`[BACKEND] Webhook: Pagamento PENDENTE para o serviço ${serviceId}, mas o status atual ('${servico.status}') não era o esperado para transição para 'aguardando_confirmacao_pagamento'.`);
                 }
            } else if (paymentStatus === 'rejected' || paymentData.status_detail === 'cc_rejected_other_reason') {
                 console.warn(`[BACKEND] Webhook: Pagamento REJEITADO para o serviço ${serviceId}. Status: ${paymentData.status}, Detail: ${paymentData.status_detail}. Status do serviço permanece: '${servico.status}'.`);
                 // Opcional: Criar notificação para o cliente sobre pagamento rejeitado
            }

            if (newStatus !== servico.status) {
                 servico.status = newStatus;
                 await servico.save();
                 console.log(`[BACKEND] Status do serviço ${serviceId} atualizado para '${newStatus}'.`);
            } else {
                 console.log(`[BACKEND] Webhook: Status do serviço ${serviceId} permaneceu '${servico.status}'.`);
            }

            res.status(200).send('Webhook recebido e processado.');

        } catch (error) {
            console.error('[BACKEND] Erro ao processar webhook do Mercado Pago:', error);
            res.status(500).send('Erro interno ao processar webhook.');
        }
    } else {
        console.log('[BACKEND] Webhook de tópico não relevante recebido:', req.query.topic);
        res.status(200).send('Notificação não relevante.');
    }
});


// Busca serviços concluídos para o prestador logado (para o histórico e contagem no dashboard)
app.get('/meus-servicos-concluidos-prestador', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /meus-servicos-concluidos-prestador para prestador: ${req.user.id}`);
        const prestadorId = req.user.id;

        const historicoServicos = await Servico.find({
            prestador_id: prestadorId,
            status: { $in: ['concluido_pelo_prestador', 'avaliado_pelo_cliente', 'cancelado'] }
        })
        .populate('usuario_id', 'nome email')
        .populate('servico_oferecido_id', 'nome'); // Popula o serviço oferecido

         // Formata a resposta para incluir nomes populados
         const formattedHistorico = historicoServicos.map(servico => ({
              ...servico.toObject(),
              nome_cliente: servico.usuario_id ? servico.usuario_id.nome : 'Cliente Desconhecido',
              nome_servico_oferecido: servico.servico_oferecido_id ? servico.servico_oferecido_id.nome : servico.tipo_servico // Usa nome do catálogo se disponível
         }));

        console.log(`[BACKEND] Encontrados ${formattedHistorico.length} serviços concluídos para o prestador.`);
        res.status(200).json(formattedHistorico);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar histórico de serviços do prestador:', error);
        next(error);
    }
});

// Busca avaliações recebidas pelo prestador logado
app.get('/minhas-avaliacoes-prestador', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /minhas-avaliacoes-prestador para prestador: ${req.user.id}`);
        const prestadorId = req.user.id;

        const avaliacoes = await Avaliacao.find({ prestador_id: prestadorId })
            .populate('cliente_id', 'nome')
            .populate('pedido_servico_id', 'tipo_servico');

        console.log(`[BACKEND] Encontradas ${avaliacoes.length} avaliações para o prestador.`);
        res.status(200).json(avaliacoes);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar avaliações do prestador:', error);
        next(error);
    }
});


// --- ENDPOINT PARA DADOS DO GRÁFICO DE LUCRO DO PRESTADOR ---
app.get('/prestador/dados-grafico-lucro', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /prestador/dados-grafico-lucro para prestador: ${req.user.id}`);
        const prestadorId = req.user.id;

        const dadosLucroMensal = await Servico.aggregate([
            {
                $match: {
                    prestador_id: new mongoose.Types.ObjectId(prestadorId),
                    status: { $in: ['concluido_pelo_prestador', 'avaliado_pelo_cliente'] },
                    valor_servico: { $exists: true, $gt: 0 }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: { $ifNull: ["$data_conclusao", "$data_solicitacao"] } },
                        month: { $month: { $ifNull: ["$data_conclusao", "$data_solicitacao"] } }
                    },
                    totalLucro: { $sum: "$valor_servico" }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        const labels = [];
        const data = [];
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        dadosLucroMensal.forEach(item => {
            labels.push(`${meses[item._id.month - 1]}/${item._id.year}`);
            data.push(item.totalLucro);
        });

        console.log(`[BACKEND] Dados de lucro mensal gerados para o prestador: ${labels.length} meses.`);
        res.status(200).json({ labels, data });

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar dados para o gráfico de lucro:', error);
        next(error);
    }
});


// --- Rotas de Recuperação de Senha ---
app.post('/forgot-password', async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /forgot-password');
    const { email } = req.body;

    const { error } = validateForgotPassword(req.body);
    if (error) {
        console.warn("[BACKEND] Forgot Password: Erro de validação Joi:", error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        let user = await Usuario.findOne({ email });
        let userType = 'usuario';
        if (!user) {
            user = await Prestador.findOne({ email });
            userType = 'prestador';
            if (!user) {
                console.warn(`[BACKEND] Forgot Password: Usuário/Prestador com email ${email} não encontrado.`);
                return res.status(404).json({ message: 'Usuário ou Prestador com este email não encontrado.' });
            }
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = Date.now() + 3600000;

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetPasswordExpires;
        await user.save();
        console.log(`[BACKEND] Forgot Password: Token de redefinição gerado para ${email}.`);

        const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password.html?token=${resetToken}`;
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'WYN - Redefinição de Senha',
            text: `Você está recebendo este email porque você (ou alguém) solicitou a redefinição da senha da sua conta.\n\n`
                  + `Por favor, clique no link a seguir, ou cole-o no seu navegador para completar o processo:\n\n`
                  + `${resetUrl}\n\n` // CORREÇÃO AQUI: Removido o backtick extra
                  + `Se você não solicitou isso, por favor ignore este email e sua senha permanecerá inalterada.\n`
                  + `Este link expirará em 1 hora.`
        };

        await transporter.sendMail(mailOptions);
        console.log(`[BACKEND] Forgot Password: Email de redefinição enviado para ${email}.`);

        res.status(200).json({ message: 'Um link para redefinir sua senha foi enviado para o seu email.' });

    } catch (error) {
        console.error('[BACKEND] Erro ao solicitar redefinição de senha:', error);
        if (error.code === 'EENVELOPE' || error.code === 'EAUTH') {
             console.error('[BACKEND] Erro específico do Nodemailer:', error.message);
        }
        next(error);
    }
});

app.post('/reset-password', async (req, res, next) => {
    console.log('[BACKEND] Recebida requisição POST /reset-password');
    const { token, novaSenha } = req.body;

    const { error } = validateResetPassword(req.body);
    if (error) {
        console.warn("[BACKEND] Reset Password: Erro de validação Joi:", error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        let user = await Usuario.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        let userType = 'usuario';

        if (!user) {
             user = await Prestador.findOne({
                 resetPasswordToken: token,
                 resetPasswordExpires: { $gt: Date.now() }
             }); // <-- CORREÇÃO AQUI: Fechamento do parêntese para Prestador.findOne
             userType = 'prestador';
             if (!user) {
                 console.warn('[BACKEND] Reset Password: Token de redefinição inválido ou expirado.');
                 return res.status(400).json({ message: 'Token de redefinição de senha inválido ou expirado.' });
             }
        }

        user.senha = await bcrypt.hash(novaSenha, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        console.log(`[BACKEND] Reset Password: Senha redefinida com sucesso para ${user.email}.`);

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Sua senha WYN foi redefinida',
            text: `Olá,\n\nEste email confirma que a senha da sua conta WYN foi redefinida com sucesso.\n\n`
                  + `Se você não redefiniu sua senha, por favor, entre em contato conosco imediatamente.`
        };
         await transporter.sendMail(mailOptions);
         console.log(`[BACKEND] Reset Password: Email de confirmação de redefinição enviado para ${user.email}.`);


        res.status(200).json({ message: 'Sua senha foi redefinida com sucesso.' });

    } catch (error) {
        console.error('[BACKEND] Erro ao redefinir senha:', error);
        next(error);
    }
});
// --- Fim Rotas de Recuperação de Senha ---


// --- ROTAS PARA GERENCIAR SERVIÇOS OFERECIDOS PELO PRESTADOR ---

// Rota para listar todos os serviços oferecidos pelo prestador logado
app.get('/prestador/servicos-oferecidos', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /prestador/servicos-oferecidos para prestador: ${req.user.id}`);
        const prestadorId = req.user.id;
        const servicos = await ServicoOferecido.find({ prestador_id: prestadorId });
        console.log(`[BACKEND] Encontrados ${servicos.length} serviços oferecidos para o prestador.`);
        res.status(200).json(servicos);
    } catch (error) {
        console.error('[BACKEND] Erro ao buscar serviços oferecidos pelo prestador:', error);
        next(error);
    }
});

// Rota para adicionar um novo serviço oferecido pelo prestador logado
app.post('/prestador/servicos-oferecidos', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log('[BACKEND] Recebida requisição POST /prestador/servicos-oferecidos');
        const prestadorId = req.user.id; // Pega o ID do prestador do token
        const { nome, descricao, faixa_preco_min, faixa_preco_max, categorias } = req.body;

        // Usa a validação CORRIGIDA que não exige prestador_id no body
        const { error, value } = validateServicoOferecido(req.body);
        if (error) {
            console.error("[BACKEND] Erro de validação Joi ao adicionar serviço oferecido:", error.details);
            return res.status(400).json({ message: error.details[0].message });
        }

        const novoServicoOferecido = new ServicoOferecido({
            prestador_id: prestadorId, // Usa o ID do prestador obtido do token
            nome: value.nome,
            descricao: value.descricao,
            faixa_preco_min: value.faixa_preco_min,
            faixa_preco_max: value.faixa_preco_max,
            categorias: value.categorias
        });

        await novoServicoOferecido.save();
        console.log(`[BACKEND] Novo serviço oferecido adicionado com sucesso para o prestador ${prestadorId}: ${novoServicoOferecido.nome} (ID: ${novoServicoOferecido._id})`);

        res.status(201).json({ message: 'Serviço oferecido adicionado com sucesso!', servico: novoServicoOferecido });

    } catch (error) {
        console.error('[BACKEND] Erro ao adicionar serviço oferecido:', error);
         if (error.code === 11000) {
             // Esta verificação de duplicidade pode precisar ser mais sofisticada
             // para verificar se é o mesmo nome DESTE prestador
             return res.status(400).json({ message: 'Este serviço já parece estar cadastrado.' });
         }
        next(error);
    }
});

// Rota para obter detalhes de um serviço oferecido específico do prestador logado
app.get('/prestador/servicos-oferecidos/:id', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /prestador/servicos-oferecidos/${req.params.id}`);
        const prestadorId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Detalhes Serviço Oferecido: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID do serviço inválido.' });
        }

        const servico = await ServicoOferecido.findOne({ _id: id, prestador_id: prestadorId });

        if (!servico) {
             console.warn(`[BACKEND] Detalhes Serviço Oferecido: Serviço oferecido ${id} não encontrado para o prestador ${prestadorId} ou sem permissão.`);
            return res.status(404).json({ message: 'Serviço oferecido não encontrado ou você não tem permissão para acessá-lo.' });
        }

        console.log(`[BACKEND] Detalhes do serviço oferecido ${id} encontrados.`);
        res.status(200).json(servico);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar serviço oferecido para edição:', error);
        next(error);
    }
});


// Rota para atualizar um serviço oferecido específico do prestador logado
app.put('/prestador/servicos-oferecidos/:id', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição PUT /prestador/servicos-oferecidos/${req.params.id}`);
        const prestadorId = req.user.id; // Pega o ID do prestador do token
        const { id } = req.params;
        const { nome, descricao, faixa_preco_min, faixa_preco_max, categorias } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Atualizar Serviço Oferecido: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID do serviço inválido.' });
        }

        // Usa a validação CORRIGIDA que não exige prestador_id no body
        const { error, value } = validateServicoOferecido(req.body);
        if (error) {
            console.error("[BACKEND] Erro de validação Joi ao atualizar serviço oferecido:", error.details);
            return res.status(400).json({ message: error.details[0].message });
        }

        const servicoAtualizado = await ServicoOferecido.findOneAndUpdate(
            { _id: id, prestador_id: prestadorId }, // Garante que o serviço pertence a este prestador
            {
                nome: value.nome,
                descricao: value.descricao,
                faixa_preco_min: value.faixa_preco_min,
                faixa_preco_max: value.faixa_preco_max,
                categorias: value.categorias
            },
            { new: true }
        );

        if (!servicoAtualizado) {
            console.warn(`[BACKEND] Atualizar Serviço Oferecido: Serviço oferecido ${id} não encontrado para o prestador ${prestadorId} ou sem permissão.`);
            return res.status(404).json({ message: 'Serviço oferecido não encontrado ou você não tem permissão para atualizá-lo.' });
        }

        console.log(`[BACKEND] Serviço oferecido ${id} atualizado com sucesso.`);
        res.status(200).json({ message: 'Serviço oferecido atualizado com sucesso!', servico: servicoAtualizado });

    } catch (error) {
        console.error('[BACKEND] Erro ao atualizar serviço oferecido:', error);
         if (error.code === 11000) {
              // Esta verificação de duplicidade pode precisar ser mais sofisticada
             // para verificar se é o mesmo nome DESTE prestador
             return res.status(400).json({ message: 'Este serviço já parece estar cadastrado.' });
         }
        next(error);
    }
});

// Rota para deletar um serviço oferecido específico do prestador logado
app.delete('/prestador/servicos-oferecidos/:id', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /prestador/servicos-oferecidos/${req.params.id}`);
        const prestadorId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Deletar Serviço Oferecido: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID do serviço inválido.' });
        }

        const servicoDeletado = await ServicoOferecido.findOneAndDelete({ _id: id, prestador_id: prestadorId });

        if (!servicoDeletado) {
            console.warn(`[BACKEND] Deletar Serviço Oferecido: Serviço oferecido ${id} não encontrado para o prestador ${prestadorId} ou sem permissão.`);
            return res.status(404).json({ message: 'Serviço oferecido não encontrado ou você não tem permissão para deletá-lo.' });
        }

        console.log(`[BACKEND] Serviço oferecido ${id} deletado com sucesso.`);
        res.status(200).json({ message: 'Serviço oferecido deletado com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] Erro ao deletar serviço oferecido:', error);
        next(error);
    }
});

// --- FIM NOVAS ROTAS PARA GERENCIAR SERVIÇOS OFERECIDOS ---


// --- NOVA ROTA PARA LISTAR SERVIÇOS OFERECIDOS NO CATÁLOGO (PARA CLIENTES) ---
app.get('/servicos-catalogo', authMiddlewareUsuario, async (req, res, next) => {
    try {
        console.log('[BACKEND] Recebida requisição GET /servicos-catalogo para usuário:', req.user.id);

        // 1. Buscar todos os serviços oferecidos e popular os dados básicos do prestador
        const servicosCatalogo = await ServicoOferecido.find({})
            .populate('prestador_id', 'nome foto_perfil'); // Popula nome e foto de perfil do prestador

        // 2. Calcular a média de avaliações para CADA prestador
        // Agrupa as avaliações por prestador_id e calcula a média da nota
        const avaliacoesPorPrestador = await Avaliacao.aggregate([
            {
                $group: {
                    _id: "$prestador_id", // Agrupa pelo ID do prestador
                    mediaAvaliacoes: { $avg: "$nota" }, // Calcula a média das notas
                    totalAvaliacoes: { $sum: 1 } // Conta o total de avaliações
                }
            }
        ]);

        // Converte o array de avaliações para um mapa para fácil acesso (prestador_id -> dados de avaliação)
        const avaliacoesMap = new Map();
        avaliacoesPorPrestador.forEach(item => {
            avaliacoesMap.set(item._id.toString(), {
                media: item.mediaAvaliacoes,
                total: item.totalAvaliacoes
            });
        });

        // 3. Formatar a resposta para incluir a URL completa da foto de perfil do prestador
        // e a média de avaliações
        const formattedServicos = servicosCatalogo.map(servico => {
            const prestadorId = servico.prestador_id ? servico.prestador_id._id.toString() : null;
            const avaliacaoDoPrestador = prestadorId ? avaliacoesMap.get(prestadorId) : null;

            return {
                ...servico.toObject(),
                nome_prestador: servico.prestador_id ? servico.prestador_id.nome : 'Prestador Desconhecido',
                foto_perfil_prestador_url: (servico.prestador_id && servico.prestador_id.foto_perfil)
                                            ? `${BACKEND_BASE_URL}/${servico.prestador_id.foto_perfil.replace(/\\/g, '/')}`
                                            : null, // URL da foto do prestador ou null
                media_avaliacoes_prestador: avaliacaoDoPrestador ? avaliacaoDoPrestador.media : 0, // Média de avaliações
                total_avaliacoes_prestador: avaliacaoDoPrestador ? avaliacaoDoPrestador.total : 0 // Total de avaliações
            };
        });

        console.log(`[BACKEND] Encontrados ${formattedServicos.length} serviços para o catálogo (com avaliações).`);
        res.status(200).json(formattedServicos);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar serviços para o catálogo:', error);
        next(error); // Passa o erro para o middleware de tratamento de erros
    }
});


// --- NOVAS ROTAS PARA GERENCIAR DISPONIBILIDADE DO PRESTADOR ---

// Rota para obter a disponibilidade de um prestador específico
app.get('/prestador/disponibilidade/:prestadorId', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição GET /prestador/disponibilidade/${req.params.prestadorId}`);
        const { prestadorId } = req.params;

        // Verifica se o ID na URL corresponde ao ID do prestador logado
        if (req.user.id !== prestadorId) {
            console.warn(`[BACKEND] Disponibilidade: Prestador ${req.user.id} tentou acessar disponibilidade de outro prestador (${prestadorId}).`);
            return res.status(403).json({ message: 'Você não tem permissão para acessar a disponibilidade de outro prestador.' });
        }

        if (!mongoose.Types.ObjectId.isValid(prestadorId)) {
             console.warn(`[BACKEND] Disponibilidade: ID do prestador inválido recebido: ${prestadorId}`);
             return res.status(400).json({ message: 'ID do prestador inválido.' });
        }

        const disponibilidade = await PrestadorDisponibilidade.findOne({ prestador_id: prestadorId });

        if (!disponibilidade) {
            console.log(`[BACKEND] Disponibilidade não encontrada para o prestador ${prestadorId}.`);
            // Retorna 404 se não encontrar, o frontend deve interpretar isso como "configurar pela primeira vez"
            return res.status(404).json({ message: 'Disponibilidade não encontrada para este prestador.' });
        }

        console.log(`[BACKEND] Disponibilidade encontrada para o prestador ${prestadorId}.`);
        res.status(200).json(disponibilidade);

    } catch (error) {
        console.error('[BACKEND] Erro ao buscar disponibilidade do prestador:', error);
        next(error);
    }
});

// Rota para salvar/atualizar a disponibilidade padrão de um prestador
app.put('/prestador/disponibilidade/:prestadorId', authMiddlewarePrestador, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição PUT /prestador/disponibilidade/${req.params.prestadorId}`);
        const { prestadorId } = req.params;
        const disponibilidadeData = req.body;

         // Verifica se o ID na URL corresponde ao ID do prestador logado
         if (req.user.id !== prestadorId) {
              console.warn(`[BACKEND] Disponibilidade: Prestador ${req.user.id} tentou atualizar disponibilidade de outro prestador (${prestadorId}).`);
              return res.status(403).json({ message: 'Você não tem permissão para atualizar a disponibilidade de outro prestador.' });
         }

         if (!mongoose.Types.ObjectId.isValid(prestadorId)) {
              console.warn(`[BACKEND] Disponibilidade: ID do prestador inválido recebido: ${prestadorId}`);
              return res.status(400).json({ message: 'ID do prestador inválido.' });
         }


        const { error, value } = validatePrestadorDisponibilidade(disponibilidadeData);
        if (error) {
            console.error("[BACKEND] Erro de validação Joi na disponibilidade:", error.details);
            return res.status(400).json({ message: error.details[0].message });
        }

        // Encontra e atualiza a disponibilidade, ou cria se não existir (upsert: true)
        const disponibilidadeAtualizada = await PrestadorDisponibilidade.findOneAndUpdate(
            { prestador_id: prestadorId },
            {
                horario_inicio_padrao: value.horario_inicio_padrao,
                horario_fim_padrao: value.horario_fim_padrao,
                dias_disponiveis: value.dias_disponiveis,
                temporariamente_indisponivel: value.temporariamente_indisponivel
            },
            { new: true, upsert: true, setDefaultsOnInsert: true } // 'upsert: true' cria se não encontrar
        );

        console.log(`[BACKEND] Disponibilidade do prestador ${prestadorId} salva/atualizada com sucesso.`);
        res.status(200).json({ message: 'Disponibilidade salva com sucesso!', disponibilidade: disponibilidadeAtualizada });

    } catch (error) {
        console.error('[BACKEND] Erro ao salvar disponibilidade do prestador:', error);
        next(error);
    }
});

// Rota para adicionar um período de indisponibilidade específico
app.post('/prestador/disponibilidade/:prestadorId/periodo', authMiddlewarePrestador, async (req, res, next) => {
     try {
          console.log(`[BACKEND] Recebida requisição POST /prestador/disponibilidade/${req.params.prestadorId}/periodo`);
          const { prestadorId } = req.params;
          const periodoData = req.body;

          // Verifica se o ID na URL corresponde ao ID do prestador logado
          if (req.user.id !== prestadorId) {
               console.warn(`[BACKEND] Período Indisponibilidade: Prestador ${req.user.id} tentou adicionar período para outro prestador (${prestadorId}).`);
               return res.status(403).json({ message: 'Você não tem permissão para adicionar períodos de indisponibilidade para outro prestador.' });
          }

          if (!mongoose.Types.ObjectId.isValid(prestadorId)) {
               console.warn(`[BACKEND] Período Indisponibilidade: ID do prestador inválido recebido: ${prestadorId}`);
               return res.status(400).json({ message: 'ID do prestador inválido.' });
          }


          const { error, value } = validatePeriodoIndisponibilidade(periodoData);
          if (error) {
              console.error("[BACKEND] Erro de validação Joi no período de indisponibilidade:", error.details);
              return res.status(400).json({ message: error.details[0].message });
          }

          const disponibilidade = await PrestadorDisponibilidade.findOne({ prestador_id: prestadorId });

          if (!disponibilidade) {
               console.warn(`[BACKEND] Período Indisponibilidade: Disponibilidade não encontrada para o prestador ${prestadorId}.`);
               return res.status(404).json({ message: 'Configuração de disponibilidade não encontrada para este prestador. Salve a disponibilidade padrão primeiro.' });
          }

          // Adiciona o novo período ao array
          disponibilidade.periodos_indisponibilidade_especificos.push(value);
          await disponibilidade.save();

          // Retorna o último período adicionado (que inclui o _id gerado)
          const novoPeriodoSalvo = disponibilidade.periodos_indisponibilidade_especificos[disponibilidade.periodos_indisponibilidade_especificos.length - 1];

          console.log(`[BACKEND] Período de indisponibilidade adicionado para o prestador ${prestadorId}.`);
          res.status(201).json({ message: 'Período de indisponibilidade adicionado com sucesso!', periodo: novoPeriodoSalvo });

     } catch (error) {
          console.error('[BACKEND] Erro ao adicionar período de indisponibilidade:', error);
          next(error);
     }
});

// Rota para atualizar um período de indisponibilidade específico
app.put('/prestador/disponibilidade/:prestadorId/periodo/:periodoId', authMiddlewarePrestador, async (req, res, next) => {
     try {
          console.log(`[BACKEND] Recebida requisição PUT /prestador/disponibilidade/${req.params.prestadorId}/periodo/${req.params.periodoId}`);
          const { prestadorId, periodoId } = req.params;
          const periodoData = req.body;

          // Verifica se os IDs correspondem ao prestador logado
          if (req.user.id !== prestadorId) {
               console.warn(`[BACKEND] Período Indisponibilidade: Prestador ${req.user.id} tentou atualizar período de outro prestador (${prestadorId}).`);
               return res.status(403).json({ message: 'Você não tem permissão para atualizar períodos de indisponibilidade de outro prestador.' });
          }

          if (!mongoose.Types.ObjectId.isValid(prestadorId) || !mongoose.Types.ObjectId.isValid(periodoId)) {
               console.warn(`[BACKEND] Período Indisponibilidade: ID do prestador (${prestadorId}) ou período (${periodoId}) inválido.`);
               return res.status(400).json({ message: 'ID do prestador ou período inválido.' });
          }

          const { error, value } = validatePeriodoIndisponibilidade(periodoData);
          if (error) {
               console.error("[BACKEND] Erro de validação Joi na atualização do período:", error.details);
               return res.status(400).json({ message: error.details[0].message });
          }

          const disponibilidade = await PrestadorDisponibilidade.findOne({ prestador_id: prestadorId });

          if (!disponibilidade) {
               console.warn(`[BACKEND] Período Indisponibilidade: Disponibilidade não encontrada para o prestador ${prestadorId}.`);
               return res.status(404).json({ message: 'Configuração de disponibilidade não encontrada para este prestador.' });
          }

          // Encontra o índice do período específico no array
          const periodoIndex = disponibilidade.periodos_indisponibilidade_especificos.findIndex(p => p._id.toString() === periodoId);

          if (periodoIndex === -1) {
               console.warn(`[BACKEND] Período Indisponibilidade: Período com ID ${periodoId} não encontrado para o prestador ${prestadorId} durante a exclusão.`);
               return res.status(404).json({ message: 'Período de indisponibilidade não encontrado.' });
          }

          // Atualiza os dados do período
          disponibilidade.periodos_indisponibilidade_especificos[periodoIndex].data_inicio = value.data_inicio;
          disponibilidade.periodos_indisponibilidade_especificos[periodoIndex].data_fim = value.data_fim;
          disponibilidade.periodos_indisponibilidade_especificos[periodoIndex].motivo = value.motivo;

          await disponibilidade.save();

          console.log(`[BACKEND] Período de indisponibilidade ${periodoId} atualizado para o prestador ${prestadorId}.`);
          res.status(200).json({ message: 'Período de indisponibilidade atualizado com sucesso!', periodo: disponibilidade.periodos_indisponibilidade_especificos[periodoIndex] });

     } catch (error) {
          console.error('[BACKEND] Erro ao atualizar período de indisponibilidade:', error);
          next(error);
     }
});

// Rota para deletar um período de indisponibilidade específico
app.delete('/prestador/disponibilidade/:prestadorId/periodo/:periodoId', authMiddlewarePrestador, async (req, res, next) => {
     try {
          console.log(`[BACKEND] Recebida requisição DELETE /prestador/disponibilidade/${req.params.prestadorId}/periodo/${req.params.periodoId}`);
          const { prestadorId, periodoId } = req.params;

          // Verifica se os IDs correspondem ao prestador logado
          if (req.user.id !== prestadorId) {
               console.warn(`[BACKEND] Período Indisponibilidade: Prestador ${req.user.id} tentou deletar período de outro prestador (${prestadorId}).`);
               return res.status(403).json({ message: 'Você não tem permissão para deletar períodos de indisponibilidade de outro prestador.' });
          }

          if (!mongoose.Types.ObjectId.isValid(prestadorId) || !mongoose.Types.ObjectId.isValid(periodoId)) {
               console.warn(`[BACKEND] Período Indisponibilidade: ID do prestador (${prestadorId}) ou período (${periodoId}) inválido.`);
               return res.status(400).json({ message: 'ID do prestador ou período inválido.' });
          }

          const disponibilidade = await PrestadorDisponibilidade.findOne({ prestador_id: prestadorId });

          if (!disponibilidade) {
               console.warn(`[BACKEND] Período Indisponibilidade: Disponibilidade não encontrada para o prestador ${prestadorId}.`);
               return res.status(404).json({ message: 'Configuração de disponibilidade não encontrada para este prestador.' });
          }

          // Remove o período específico do array pelo ID
          const initialLength = disponibilidade.periodos_indisponibilidade_especificos.length;
          disponibilidade.periodos_indisponibilidade_especificos = disponibilidade.periodos_indisponibilidade_especificos.filter(p => p._id.toString() !== periodoId);

          if (disponibilidade.periodos_indisponibilidade_especificos.length === initialLength) {
               console.warn(`[BACKEND] Período Indisponibilidade: Período com ID ${periodoId} não encontrado para o prestador ${prestadorId} durante a exclusão.`);
               return res.status(404).json({ message: 'Período de indisponibilidade não encontrado.' });
          }

          await disponibilidade.save();

          console.log(`[BACKEND] Período de indisponibilidade ${periodoId} deletado para o prestador ${prestadorId}.`);
          res.status(200).json({ message: 'Período de indisponibilidade excluído com sucesso!' });

     } catch (error) {
          console.error('[BACKEND] Erro ao deletar período de indisponibilidade:', error);
          next(error);
     }
});

// --- FIM NOVAS ROTAS PARA GERENCIAR DISPONIBILIDADE ---


// --- NOVAS ROTAS PARA O DASHBOARD ADMIN ---

// Rota para contar todos os usuários (ADMIN)
app.get('/admin/count/usuarios', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Contando usuários...');
        const total = await Usuario.countDocuments();
        console.log(`[BACKEND] ADMIN: Total de usuários: ${total}`);
        res.status(200).json({ total });
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao contar usuários:', error);
        next(error);
    }
});

// Rota para contar todos os prestadores (ADMIN)
app.get('/admin/count/prestadores', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Contando prestadores...');
        const total = await Prestador.countDocuments();
        console.log(`[BACKEND] ADMIN: Total de prestadores: ${total}`);
        res.status(200).json({ total });
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao contar prestadores:', error);
        next(error);
    }
});

// Rota para contar todos os serviços (pedidos) (ADMIN)
app.get('/admin/count/servicos', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Contando serviços (pedidos)...');
        const total = await Servico.countDocuments();
        console.log(`[BACKEND] ADMIN: Total de serviços (pedidos): ${total}`);
        res.status(200).json({ total });
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao contar serviços (pedidos):', error);
        next(error);
    }
});

// Rota para contar todas as avaliações (ADMIN)
app.get('/admin/count/avaliacoes', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Contando avaliações...');
        const total = await Avaliacao.countDocuments();
        console.log(`[BACKEND] ADMIN: Total de avaliações: ${total}`);
        res.status(200).json({ total });
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao contar avaliações:', error);
        next(error);
    }
});

// Rota para dados do gráfico de serviços por status (ADMIN)
app.get('/admin/stats/servicos-por-status', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Gerando dados de serviços por status para gráfico...');
        const dados = await Servico.aggregate([
            {
                $match: {
                    // Sem filtro de prestador_id aqui, pois é para o admin ver todos
                }
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    status: "$_id",
                    count: 1
                }
            }
        ]);

        const labels = dados.map(item => item.status);
        const data = dados.map(item => item.count);

        console.log(`[BACKEND] ADMIN: Dados de serviços por status gerados: ${labels.length} status.`);
        res.status(200).json({ labels, data });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao gerar dados de serviços por status:', error);
        next(error);
    }
});


// Rota para listar todos os usuários (ADMIN)
app.get('/admin/usuarios', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Listando usuários...');
        // Exclui a senha da resposta
        const usuarios = await Usuario.find({}).select('-senha');
        console.log(`[BACKEND] ADMIN: Encontrados ${usuarios.length} usuários.`);
        res.status(200).json(usuarios);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao listar usuários:', error);
        next(error);
    }
});

// Rota para obter detalhes de um usuário específico (ADMIN)
app.get('/admin/usuarios/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] ADMIN: Buscando detalhes do usuário ${req.params.id}...`);
        const { id } = req.params;
         if (!mongoose.Types.ObjectId.isValid(id)) {
              console.warn(`[BACKEND] ADMIN: Detalhes Usuário: ID inválido recebido: ${id}`);
              return res.status(400).json({ message: 'ID de usuário inválido.' });
         }
        // Exclui a senha da resposta
        const usuario = await Usuario.findById(id).select('-senha');
        if (!usuario) {
            console.warn(`[BACKEND] ADMIN: Usuário ${id} não encontrado.`);
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        console.log(`[BACKEND] ADMIN: Detalhes do usuário ${id} encontrados.`);
        res.status(200).json(usuario);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao buscar detalhes do usuário:', error);
        next(error);
    }
});

// Rota para criar um novo usuário (ADMIN)
app.post('/admin/usuarios', adminAuthMiddleware, uploadProfilePicture, async (req, res, next) => {
    console.log('[BACKEND] ADMIN: Recebida requisição POST /admin/usuarios');
    const { nome, telefone, email, senha, isAdmin } = req.body; // Admin pode definir isAdmin
    const fotoPerfil = req.file;

    const { error, value } = validateCadastroUsuario({ nome, telefone, email, senha }); // Reutiliza validação básica
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao criar usuário:", error.details);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                 if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
              });
         }
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const usuarioExistente = await Usuario.findOne({ email: value.email });
        if (usuarioExistente) {
             console.warn(`[BACKEND] ADMIN: Tentativa de criar usuário com email duplicado: ${value.email}`);
              if (fotoPerfil) {
                   const filePath = path.join(__dirname, fotoPerfil.path);
                   fs.unlink(filePath, (err) => {
                      if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após email duplicado:`, err);
                   });
              }
            return res.status(400).json({ message: 'Email já cadastrado.' });
        }

        const senhaHash = await bcrypt.hash(value.senha, 10);
        const novoUsuario = new Usuario({
            nome: value.nome,
            email: value.email,
            senha: senhaHash,
            telefone: value.telefone,
            foto_perfil: fotoPerfil ? fotoPerfil.path : null,
             isAdmin: isAdmin === 'true' || isAdmin === true // Converte string 'true'/'false' para boolean
        });
        await novoUsuario.save();

        console.log(`[BACKEND] ADMIN: Usuário criado com sucesso: ${novoUsuario.email} (Admin: ${novoUsuario.isAdmin})`);
        // Exclui a senha da resposta
        const usuarioCriado = novoUsuario.toObject();
        delete usuarioCriado.senha;
        res.status(201).json({ message: 'Usuário criado com sucesso!', usuario: usuarioCriado });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao criar usuário:', error);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro no banco de dados:`, err);
              });
         }
         if (error.code === 11000) {
              return res.status(400).json({ message: 'Email já cadastrado.' });
         }
        next(error);
    }
});

// Rota para atualizar um usuário existente (ADMIN)
app.put('/admin/usuarios/:id', adminAuthMiddleware, uploadProfilePicture, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /admin/usuarios/${req.params.id}`);
    const { id } = req.params;
    const updateData = req.body;
    const fotoPerfil = req.file;

     if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] ADMIN: Atualizar Usuário: ID inválido recebido: ${id}`);
          if (fotoPerfil) {
               const filePath = path.join(__dirname, fotoPerfil.path);
               fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após ID inválido:`, err);
               });
          }
          return res.status(400).json({ message: 'ID de usuário inválido.' });
     }

    // Valida os dados recebidos para atualização (excluindo senha e foto de perfil, que são tratadas separadamente)
    const dataToValidate = { ...updateData };
    delete dataToValidate.senha; // Não validar senha aqui
    delete dataToValidate.foto_perfil; // Não validar foto de perfil aqui

    const { error, value } = validateAdminUsuarioUpdate(dataToValidate);
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao atualizar usuário:", error.details);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                 if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
              });
         }
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const usuario = await Usuario.findById(id);
        if (!usuario) {
            console.warn(`[BACKEND] ADMIN: Usuário ${id} não encontrado para atualização.`);
             if (fotoPerfil) {
                  const filePath = path.join(__dirname, fotoPerfil.path);
                  fs.unlink(filePath, (err) => {
                     if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após usuário não encontrado:`, err);
                  });
             }
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Atualiza os campos permitidos
        if (value.nome !== undefined) usuario.nome = value.nome;
        if (value.email !== undefined) usuario.email = value.email;
        if (value.telefone !== undefined) usuario.telefone = value.telefone;
        // if (value.isAdmin !== undefined) usuario.isAdmin = value.isAdmin; // Permite admin mudar status de admin

        // Lida com o upload da nova foto de perfil
        if (fotoPerfil) {
             // Se já existe uma foto, tenta deletar a antiga
             if (usuario.foto_perfil) {
                  const oldFilePath = path.join(__dirname, usuario.foto_perfil);
                  if (fs.existsSync(oldFilePath)) {
                       fs.unlink(oldFilePath, (err) => {
                           if (err) console.error(`[BACKEND] Erro ao excluir foto de perfil antiga ${oldFilePath}:`, err);
                       });
                  } else {
                       console.warn(`[BACKEND] Foto de perfil antiga não encontrada para exclusão: ${oldFilePath}`);
                  }
             }
             usuario.foto_perfil = fotoPerfil.path; // Salva o caminho da nova foto
        }

        await usuario.save();

        console.log(`[BACKEND] ADMIN: Usuário ${id} atualizado com sucesso.`);
         // Exclui a senha da resposta
         const usuarioAtualizado = usuario.toObject();
         delete usuarioAtualizado.senha;
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', usuario: usuarioAtualizado });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao atualizar usuário:', error);
         if (error.code === 11000) {
              return res.status(400).json({ message: 'Email já cadastrado.' });
         }
        next(error);
    }
});

// Rota para deletar um usuário (ADMIN)
app.delete('/admin/usuarios/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /admin/usuarios/${req.params.id}`);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] ADMIN: Deletar Usuário: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID de usuário inválido.' });
        }

        // --- VERIFICAÇÕES DE SEGURANÇA ADICIONAIS (OPCIONAL) ---
        // Impedir que o admin delete a si mesmo
        if (req.user.id === id) {
             console.warn(`[BACKEND] ADMIN: Tentativa de auto-exclusão pelo usuário ${id}.`);
             return res.status(400).json({ message: 'Você não pode deletar sua própria conta de administrador por aqui.' });
        }
         // Impedir que um admin delete outro admin (se houver múltiplos) - requer lógica mais complexa

        const usuarioToDelete = await Usuario.findById(id);
        if (!usuarioToDelete) {
             console.warn(`[BACKEND] ADMIN: Usuário ${id} não encontrado para exclusão.`);
             return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // --- Lidar com dependências (serviços, avaliações, mensagens, etc.) ---
        // Você precisa decidir o que acontece com os dados associados a este usuário.
        // Opções:
        // 1. Deletar em cascata (perigoso, pode perder muitos dados)
        // 2. Desassociar (definir usuario_id para null em serviços, avaliações, etc.)
        // 3. Marcar como "usuário deletado" em vez de excluir o documento

        console.log(`[BACKEND] ADMIN: Desassociando serviços do usuário ${id}...`);
        // Exemplo: Desassociar serviços
        await Servico.updateMany({ usuario_id: id }, { usuario_id: null, nome_cliente: '[Usuário Deletado]', email_cliente: '[Usuário Deletado]' });

        console.log(`[BACKEND] ADMIN: Deletando avaliações feitas pelo usuário ${id}...`);
         await Avaliacao.deleteMany({ cliente_id: id });

        console.log(`[BACKEND] ADMIN: Deletando mensagens enviadas pelo usuário ${id}...`);
         await Message.deleteMany({ remetente_id: id, remetente_tipo: 'usuario' });

        // Deleta a foto de perfil associada
        if (usuarioToDelete.foto_perfil) {
             const filePath = path.join(__dirname, usuarioToDelete.foto_perfil);
             if (fs.existsSync(filePath)) {
                  fs.unlink(filePath, (err) => {
                      if (err) console.error(`[BACKEND] Erro ao excluir foto de perfil do usuário ${id}:`, err);
                  });
             } else {
                  console.warn(`[BACKEND] Foto de perfil do usuário ${id} não encontrada para exclusão: ${filePath}`);
             }
        }

        console.log(`[BACKEND] ADMIN: Deletando usuário ${id}...`);
        const usuarioDeletado = await Usuario.findByIdAndDelete(id);

        console.log(`[BACKEND] ADMIN: Usuário ${id} deletado com sucesso.`);
        res.status(200).json({ message: 'Usuário deletado com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao deletar usuário:', error);
        next(error);
    }
});


// Rota para listar todos os prestadores (ADMIN)
app.get('/admin/prestadores', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Listando prestadores...');
        // Exclui a senha da resposta
        const prestadores = await Prestador.find({}).select('-senha');
        console.log(`[BACKEND] ADMIN: Encontrados ${prestadores.length} prestadores.`);
        res.status(200).json(prestadores);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao listar prestadores:', error);
        next(error);
    }
});

// Rota para obter detalhes de um prestador específico (ADMIN)
app.get('/admin/prestadores/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] ADMIN: Buscando detalhes do prestador ${req.params.id}...`);
        const { id } = req.params;
         if (!mongoose.Types.ObjectId.isValid(id)) {
              console.warn(`[BACKEND] ADMIN: Detalhes Prestador: ID inválido recebido: ${id}`);
              return res.status(400).json({ message: 'ID de prestador inválido.' });
         }
        // Exclui a senha da resposta
        const prestador = await Prestador.findById(id).select('-senha');
        if (!prestador) {
            console.warn(`[BACKEND] ADMIN: Prestador ${id} não encontrado.`);
            return res.status(404).json({ message: 'Prestador não encontrado.' });
        }
        console.log(`[BACKEND] ADMIN: Detalhes do prestador ${id} encontrados.`);
        res.status(200).json(prestador);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao buscar detalhes do prestador:', error);
        next(error);
    }
});

// Rota para criar um novo prestador (ADMIN)
app.post('/admin/prestadores', adminAuthMiddleware, uploadProfilePicture, async (req, res, next) => {
    console.log('[BACKEND] ADMIN: Recebida requisição POST /admin/prestadores');
    const { nome, telefone, email, senha } = req.body;
    const fotoPerfil = req.file;

    const { error, value } = validateCadastroPrestador({ nome, telefone, email, senha }); // Reutiliza validação básica
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao criar prestador:", error.details);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                 if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
              });
         }
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const prestadorExistente = await Prestador.findOne({ email: value.email });
        if (prestadorExistente) {
             console.warn(`[BACKEND] ADMIN: Tentativa de criar prestador com email duplicado: ${value.email}`);
              if (fotoPerfil) {
                   const filePath = path.join(__dirname, fotoPerfil.path);
                   fs.unlink(filePath, (err) => {
                      if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após email duplicado:`, err);
                   });
              }
            return res.status(400).json({ message: 'Email já cadastrado.' });
        }

        const senhaHash = await bcrypt.hash(value.senha, 10);
        const novoPrestador = new Prestador({
            nome: value.nome,
            email: value.email,
            senha: senhaHash,
            telefone: value.telefone,
            foto_perfil: fotoPerfil ? fotoPerfil.path : null
        });
        await novoPrestador.save();

        console.log(`[BACKEND] ADMIN: Prestador criado com sucesso: ${novoPrestador.email}`);
         // Exclui a senha da resposta
         const prestadorCriado = novoPrestador.toObject();
         delete prestadorCriado.senha;
        res.status(201).json({ message: 'Prestador criado com sucesso!', prestador: prestadorCriado });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao criar prestador:', error);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro no banco de dados:`, err);
               });
         }
         if (error.code === 11000) {
              return res.status(400).json({ message: 'Email já cadastrado.' });
         }
        next(error);
    }
});

// Rota para atualizar um prestador existente (ADMIN)
app.put('/admin/prestadores/:id', adminAuthMiddleware, uploadProfilePicture, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /admin/prestadores/${req.params.id}`);
    const { id } = req.params;
    const updateData = req.body;
    const fotoPerfil = req.file;

     if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] ADMIN: Atualizar Prestador: ID inválido recebido: ${id}`);
          if (fotoPerfil) {
               const filePath = path.join(__dirname, fotoPerfil.path);
               fs.unlink(filePath, (err) => {
                  if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após ID inválido:`, err);
               });
          }
          return res.status(400).json({ message: 'ID de prestador inválido.' });
     }

    // Valida os dados recebidos para atualização
    const dataToValidate = { ...updateData };
    delete dataToValidate.senha; // Não validar senha aqui
    delete dataToValidate.foto_perfil; // Não validar foto de perfil aqui

    const { error, value } = validateAdminPrestadorUpdate(dataToValidate);
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao atualizar prestador:", error.details);
         if (fotoPerfil) {
              const filePath = path.join(__dirname, fotoPerfil.path);
              fs.unlink(filePath, (err) => {
                 if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após erro de validação:`, err);
              });
         }
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const prestador = await Prestador.findById(id);
        if (!prestador) {
            console.warn(`[BACKEND] ADMIN: Prestador ${id} não encontrado para atualização.`);
             if (fotoPerfil) {
                  const filePath = path.join(__dirname, fotoPerfil.path);
                  fs.unlink(filePath, (err) => {
                     if (err) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath} após prestador não encontrado:`, err);
                  });
             }
            return res.status(404).json({ message: 'Prestador não encontrado.' });
        }

        // Atualiza os campos permitidos
        if (value.nome !== undefined) prestador.nome = value.nome;
        if (value.email !== undefined) prestador.email = value.email;
        if (value.telefone !== undefined) prestador.telefone = value.telefone;

        // Lida com o upload da nova foto de perfil
        if (fotoPerfil) {
             // Se já existe uma foto, tenta deletar a antiga
             if (prestador.foto_perfil) {
                  const oldFilePath = path.join(__dirname, prestador.foto_perfil);
                  if (fs.existsSync(oldFilePath)) {
                       fs.unlink(oldFilePath, (err) => {
                           if (err) console.error(`[BACKEND] Erro ao excluir foto de perfil antiga do prestador ${oldFilePath}:`, err);
                       });
                  } else {
                       console.warn(`[BACKEND] Foto de perfil antiga do prestador não encontrada para exclusão: ${oldFilePath}`);
                  }
             }
             prestador.foto_perfil = fotoPerfil.path; // Salva o caminho da nova foto
        }

        await prestador.save();

        console.log(`[BACKEND] ADMIN: Prestador ${id} atualizado com sucesso.`);
         // Exclui a senha da resposta
         const prestadorAtualizado = prestador.toObject();
         delete prestadorAtualizado.senha;
        res.status(200).json({ message: 'Prestador atualizado com sucesso!', prestador: prestadorAtualizado });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao atualizar prestador:', error);
         if (error.code === 11000) {
              return res.status(400).json({ message: 'Email já cadastrado.' });
         }
        next(error);
    }
});

// Rota para deletar um prestador (ADMIN)
app.delete('/admin/prestadores/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /admin/prestadores/${req.params.id}`);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] ADMIN: Deletar Prestador: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID de prestador inválido.' });
        }

        const prestadorToDelete = await Prestador.findById(id);
        if (!prestadorToDelete) {
             console.warn(`[BACKEND] ADMIN: Prestador ${id} não encontrado para exclusão.`);
             return res.status(404).json({ message: 'Prestador não encontrado.' });
        }

        // --- Lidar com dependências (serviços, serviços oferecidos, avaliações, mensagens, etc.) ---
        console.log(`[BACKEND] ADMIN: Desassociando serviços do prestador ${id}...`);
        // Exemplo: Desassociar serviços (pedidos)
        await Servico.updateMany({ prestador_id: id }, { prestador_id: null }); // Não deletar os pedidos, apenas desassociar o prestador

        console.log(`[BACKEND] ADMIN: Deletando serviços oferecidos pelo prestador ${id}...`);
         await ServicoOferecido.deleteMany({ prestador_id: id });

        console.log(`[BACKEND] ADMIN: Deletando avaliações recebidas pelo prestador ${id}...`);
         await Avaliacao.deleteMany({ prestador_id: id });

        console.log(`[BACKEND] ADMIN: Deletando mensagens enviadas pelo prestador ${id}...`);
         await Message.deleteMany({ remetente_id: id, remetente_tipo: 'prestador' });

         console.log(`[BACKEND] ADMIN: Deletando configuração de disponibilidade do prestador ${id}...`);
          await PrestadorDisponibilidade.deleteOne({ prestador_id: id });


        // Deleta a foto de perfil associada
        if (prestadorToDelete.foto_perfil) {
             const filePath = path.join(__dirname, prestadorToDelete.foto_perfil);
             if (fs.existsSync(filePath)) {
                  fs.unlink(filePath, (err) => {
                      if (err) console.error(`[BACKEND] Erro ao excluir foto de perfil do prestador ${id}:`, err);
                  });
             } else {
                  console.warn(`[BACKEND] Foto de perfil do prestador ${id} não encontrada para exclusão: ${filePath}`);
             }
        }


        console.log(`[BACKEND] ADMIN: Deletando prestador ${id}...`);
        const prestadorDeletado = await Prestador.findByIdAndDelete(id);

        console.log(`[BACKEND] ADMIN: Prestador ${id} deletado com sucesso.`);
        res.status(200).json({ message: 'Prestador deletado com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao deletar prestador:', error);
        next(error);
    }
});


// Rota para listar todos os serviços (pedidos) (ADMIN)
app.get('/admin/servicos', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Listando serviços (pedidos)...');
        // Popula cliente, prestador e serviço oferecido para exibição
        const servicos = await Servico.find({})
            .populate('usuario_id', 'nome email')
            .populate('prestador_id', 'nome email')
            .populate('servico_oferecido_id', 'nome');

        console.log(`[BACKEND] ADMIN: Encontrados ${servicos.length} serviços (pedidos).`);
        res.status(200).json(servicos);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao listar serviços (pedidos):', error);
        next(error);
    }
});

// Rota para obter detalhes de um serviço (pedido) específico (ADMIN)
app.get('/admin/servicos/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] ADMIN: Buscando detalhes do serviço (pedido) ${req.params.id}...`);
        const { id } = req.params;
         if (!mongoose.Types.ObjectId.isValid(id)) {
              console.warn(`[BACKEND] ADMIN: Detalhes Serviço (Pedido): ID inválido recebido: ${id}`);
              return res.status(400).json({ message: 'ID de serviço inválido.' });
         }
        // Popula todos os dados relevantes para a tela de detalhes do admin
        const servico = await Servico.findById(id)
            .populate('usuario_id', 'nome email telefone foto_perfil')
            .populate('prestador_id', 'nome email telefone foto_perfil')
            .populate('servico_oferecido_id', 'nome descricao faixa_preco_min faixa_preco_max');

        if (!servico) {
            console.warn(`[BACKEND] ADMIN: Serviço (pedido) ${id} não encontrado.`);
            return res.status(404).json({ message: 'Serviço (pedido) não encontrado.' });
        }

        // Busca comprovantes associados
        const comprovacoes = await ComprovacaoServico.find({ pedido_servico_id: id });
         const comprovantes_url = comprovacoes.map(comp =>
              `${BACKEND_BASE_URL}/${comp.caminho_arquivo.replace(/\\/g, '/')}`
         );

        // Busca avaliação associada
        const avaliacao = await Avaliacao.findOne({ pedido_servico_id: id });
         const avaliacao_cliente = avaliacao ? avaliacao.nota : null;
         const comentario_cliente = avaliacao ? avaliacao.comentario : null;


        const responseData = {
             ...servico.toObject(),
             nome_cliente: servico.usuario_id ? servico.usuario_id.nome : 'Cliente Desconhecido',
             email_cliente: servico.usuario_id ? servico.usuario_id.email : 'Email Desconhecido',
             telefone_cliente: servico.usuario_id ? servico.usuario_id.telefone : 'Telefone Desconhecido',
             foto_perfil_cliente_url: (servico.usuario_id && servico.usuario_id.foto_perfil) ? `${BACKEND_BASE_URL}/${servico.usuario_id.foto_perfil.replace(/\\/g, '/')}` : null,

             nome_prestador: servico.prestador_id ? servico.prestador_id.nome : 'Prestador Não Atribuído',
             email_prestador: servico.prestador_id ? servico.prestador_id.email : 'Email Não Atribuído',
             telefone_prestador: servico.prestador_id ? servico.prestador_id.telefone : 'Telefone Não Atribuído',
             foto_perfil_prestador_url: (servico.prestador_id && servico.prestador_id.foto_perfil) ? `${BACKEND_BASE_URL}/${servico.prestador_id.foto_perfil.replace(/\\/g, '/')}` : null,

             detalhes_servico_oferecido: servico.servico_oferecido_id ? {
                  _id: servico.servico_oferecido_id._id,
                  nome: servico.servico_oferecido_id.nome,
                  descricao: servico.servico_oferecido_id.descricao,
                  faixa_preco_min: servico.servico_oferecido_id.faixa_preco_min,
                  faixa_preco_max: servico.servico_oferecido_id.faixa_preco_max,
             } : null,
             comprovantes_url: comprovantes_url,
             avaliacao_cliente: avaliacao_cliente,
             comentario_cliente: comentario_cliente,
         };


        console.log(`[BACKEND] ADMIN: Detalhes do serviço (pedido) ${id} encontrados.`);
        res.status(200).json(responseData);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao buscar detalhes do serviço (pedido):', error);
        next(error);
    }
});

// Rota para atualizar um serviço (pedido) existente (ADMIN)
app.put('/admin/servicos/:id', adminAuthMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /admin/servicos/${req.params.id}`);
    const { id } = req.params;
    const updateData = req.body;

     if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] ADMIN: Atualizar Serviço (Pedido): ID inválido recebido: ${id}`);
          return res.status(400).json({ message: 'ID de serviço inválido.' });
     }

    const { error, value } = validateAdminServicoUpdate(updateData);
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao atualizar serviço (pedido):", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const servico = await Servico.findById(id);
        if (!servico) {
            console.warn(`[BACKEND] ADMIN: Serviço (pedido) ${id} não encontrado para atualização.`);
            return res.status(404).json({ message: 'Serviço (pedido) não encontrado.' });
        }

        // Atualiza os campos permitidos
        if (value.prestador_id !== undefined) servico.prestador_id = value.prestador_id;
        if (value.status !== undefined) servico.status = value.status;
        if (value.valor_servico !== undefined) servico.valor_servico = value.valor_servico;
        if (value.data_servico_preferencial !== undefined) servico.data_servico_preferencial = value.data_servico_preferencial;
        if (value.hora_servico_preferencial !== undefined) servico.hora_servico_preferencial = value.hora_servico_preferencial;
        if (value.endereco_servico !== undefined) servico.endereco_servico = value.endereco_servico;
        if (value.notas_adicionais !== undefined) servico.notas_adicionais = value.notas_adicionais;
        if (value.urgente !== undefined) servico.urgente = value.urgente;

        // Opcional: Atualizar data_aceite ou data_conclusao se o status for alterado para 'aceito_pelo_prestador' ou 'concluido_pelo_prestador'
         if (value.status === 'aceito_pelo_prestador' && !servico.data_aceite) {
              servico.data_aceite = new Date();
         }
         if (value.status === 'concluido_pelo_prestador' && !servico.data_conclusao) {
              servico.data_conclusao = new Date();
         }


        await servico.save();

        console.log(`[BACKEND] ADMIN: Serviço (pedido) ${id} atualizado com sucesso.`);
        res.status(200).json({ message: 'Serviço (pedido) atualizado com sucesso!', servico });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao atualizar serviço (pedido):', error);
        next(error);
    }
});

// Rota para deletar um serviço (pedido) (ADMIN) - JÁ IMPLEMENTADO NA ROTA /deletar-servico/:id COM VERIFICAÇÃO DE ADMIN
// app.delete('/admin/servicos/:id', adminAuthMiddleware, async (req, res, next) => { ... });


// Rota para listar todos os serviços oferecidos (catálogo) (ADMIN)
app.get('/admin/servicos-oferecidos', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Listando serviços oferecidos (catálogo)...');
        // Popula o prestador associado
        const servicos = await ServicoOferecido.find({}).populate('prestador_id', 'nome email');
        console.log(`[BACKEND] ADMIN: Encontrados ${servicos.length} serviços oferecidos (catálogo).`);
        res.status(200).json(servicos);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao listar serviços oferecidos (catálogo):', error);
        next(error);
    }
});

// Rota para obter detalhes de um serviço oferecido específico (catálogo) (ADMIN)
app.get('/admin/servicos-oferecidos/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] ADMIN: Buscando detalhes do serviço oferecido (catálogo) ${req.params.id}...`);
        const { id } = req.params;
         if (!mongoose.Types.ObjectId.isValid(id)) {
              console.warn(`[BACKEND] ADMIN: Detalhes Serviço Oferecido: ID inválido recebido: ${id}`);
              return res.status(400).json({ message: 'ID de serviço oferecido inválido.' });
         }
        // Popula o prestador associado
        const servico = await ServicoOferecido.findById(id).populate('prestador_id', 'nome email');
        if (!servico) {
            console.warn(`[BACKEND] ADMIN: Serviço oferecido (catálogo) ${id} não encontrado.`);
            return res.status(404).json({ message: 'Serviço oferecido (catálogo) não encontrado.' });
        }
        console.log(`[BACKEND] ADMIN: Detalhes do serviço oferecido (catálogo) ${id} encontrados.`);
        res.status(200).json(servico);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao buscar detalhes do serviço oferecido (catálogo):', error);
        next(error);
    }
});

// Rota para criar um novo serviço oferecido (catálogo) (ADMIN)
app.post('/admin/servicos-oferecidos', adminAuthMiddleware, async (req, res, next) => {
    console.log('[BACKEND] ADMIN: Recebida requisição POST /admin/servicos-oferecidos');
    const { prestador_id, nome, descricao, faixa_preco_min, faixa_preco_max, categorias } = req.body;

    const { error, value } = validateServicoOferecido(req.body);
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao criar serviço oferecido:", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        // Verifica se o prestador_id fornecido existe
        const prestador = await Prestador.findById(value.prestador_id);
        if (!prestador) {
             console.warn(`[BACKEND] ADMIN: Prestador com ID ${value.prestador_id} não encontrado ao criar serviço oferecido.`);
             return res.status(404).json({ message: 'Prestador associado não encontrado.' });
        }

        const novoServicoOferecido = new ServicoOferecido({
            prestador_id: value.prestador_id,
            nome: value.nome,
            descricao: value.descricao,
            faixa_preco_min: value.faixa_preco_min,
            faixa_preco_max: value.faixa_preco_max,
            categorias: value.categorias
        });

        await novoServicoOferecido.save();
        console.log(`[BACKEND] ADMIN: Novo serviço oferecido criado com sucesso: ${novoServicoOferecido.nome} (ID: ${novoServicoOferecido._id})`);

        res.status(201).json({ message: 'Serviço oferecido criado com sucesso!', servico: novoServicoOferecido });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao criar serviço oferecido:', error);
         if (error.code === 11000) {
             return res.status(400).json({ message: 'Este serviço já parece estar cadastrado para este prestador.' });
         }
        next(error);
    }
});

// Rota para atualizar um serviço oferecido existente (catálogo) (ADMIN)
app.put('/admin/servicos-oferecidos/:id', adminAuthMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /admin/servicos-oferecidos/${req.params.id}`);
    const { id } = req.params;
    const updateData = req.body;

     if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] ADMIN: Atualizar Serviço Oferecido: ID inválido recebido: ${id}`);
          return res.status(400).json({ message: 'ID de serviço oferecido inválido.' });
     }

    const { error, value } = validateAdminServicoOferecidoUpdate(updateData);
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao atualizar serviço oferecido:", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const servico = await ServicoOferecido.findById(id);
        if (!servico) {
            console.warn(`[BACKEND] ADMIN: Serviço oferecido ${id} não encontrado para atualização.`);
            return res.status(404).json({ message: 'Serviço oferecido não encontrado.' });
        }

         // Verifica se o novo prestador_id fornecido existe, se estiver sendo atualizado
         if (value.prestador_id !== undefined && value.prestador_id !== null) {
             const prestador = await Prestador.findById(value.prestador_id);
             if (!prestador) {
                  console.warn(`[BACKEND] ADMIN: Novo Prestador com ID ${value.prestador_id} não encontrado ao atualizar serviço oferecido.`);
                  return res.status(404).json({ message: 'Novo prestador associado não encontrado.' });
             }
         }


        // Atualiza os campos permitidos
        if (value.prestador_id !== undefined) servico.prestador_id = value.prestador_id;
        if (value.nome !== undefined) servico.nome = value.nome;
        if (value.descricao !== undefined) servico.descricao = value.descricao;
        if (value.faixa_preco_min !== undefined) servico.faixa_preco_min = value.faixa_preco_min;
        if (value.faixa_preco_max !== undefined) servico.faixa_preco_max = value.faixa_preco_max;
        if (value.categorias !== undefined) servico.categorias = value.categorias;


        await servico.save();

        console.log(`[BACKEND] ADMIN: Serviço oferecido ${id} atualizado com sucesso.`);
        res.status(200).json({ message: 'Serviço oferecido atualizado com sucesso!', servico });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao atualizar serviço oferecido:', error);
         if (error.code === 11000) {
             return res.status(400).json({ message: 'Este serviço já parece estar cadastrado para este prestador.' });
         }
        next(error);
    }
});

// Rota para deletar um serviço oferecido (catálogo) (ADMIN)
app.delete('/admin/servicos-oferecidos/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /admin/servicos-oferecidos/${req.params.id}`);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] ADMIN: Deletar Serviço Oferecido: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID de serviço oferecido inválido.' });
        }

        const servicoToDelete = await ServicoOferecido.findById(id);
        if (!servicoToDelete) {
             console.warn(`[BACKEND] ADMIN: Serviço oferecido ${id} não encontrado para exclusão.`);
             return res.status(404).json({ message: 'Serviço oferecido não encontrado.' });
        }

        // --- Lidar com dependências (serviços/pedidos que referenciam este serviço oferecido) ---
        // Você precisa decidir o que acontece com os pedidos que foram baseados neste serviço do catálogo.
        // Opções:
        // 1. Deletar em cascata os pedidos (perigoso)
        // 2. Desassociar (definir servico_oferecido_id para null nos pedidos)
        // 3. Marcar o serviço oferecido como inativo em vez de deletar
        await Servico.updateMany({ servico_oferecido_id: id }, { servico_oferecido_id: null }); // Exemplo: Desassociar


        console.log(`[BACKEND] ADMIN: Deletando serviço oferecido (catálogo) ${id}...`);
        const servicoDeletado = await ServicoOferecido.findByIdAndDelete(id);

        console.log(`[BACKEND] ADMIN: Serviço oferecido (catálogo) ${id} deletado com sucesso.`);
        res.status(200).json({ message: 'Serviço oferecido (catálogo) deletado com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao deletar serviço oferecido (catálogo):', error);
        next(error);
    }
});


// Rota para listar todas as avaliações (ADMIN)
app.get('/admin/avaliacoes', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log('[BACKEND] ADMIN: Listando avaliações...');
        const avaliacoes = await Avaliacao.find({})
            .populate('cliente_id', 'nome email')
            .populate('prestador_id', 'nome email')
            .populate('pedido_servico_id', 'tipo_servico'); // Popula o tipo de serviço do pedido

        console.log(`[BACKEND] ADMIN: Encontradas ${avaliacoes.length} avaliações.`);
        res.status(200).json(avaliacoes);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao listar avaliações:', error);
        next(error);
    }
});

// Rota para obter detalhes de uma avaliação específica (ADMIN)
app.get('/admin/avaliacoes/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] ADMIN: Buscando detalhes da avaliação ${req.params.id}...`);
        const { id } = req.params;
         if (!mongoose.Types.ObjectId.isValid(id)) {
              console.warn(`[BACKEND] ADMIN: Detalhes Avaliação: ID inválido recebido: ${id}`);
              return res.status(400).json({ message: 'ID de avaliação inválido.' });
         }
        const avaliacao = await Avaliacao.findById(id)
            .populate('cliente_id', 'nome email')
            .populate('prestador_id', 'nome email')
            .populate('pedido_servico_id', 'tipo_servico'); // Popula o tipo de serviço do pedido

        if (!avaliacao) {
            console.warn(`[BACKEND] Avaliação ${id} não encontrada.`);
            return res.status(404).json({ message: 'Avaliação não encontrada.' });
        }
        console.log(`[BACKEND] Detalhes da avaliação ${id} encontrados.`);
        res.status(200).json(avaliacao);
    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao buscar detalhes da avaliação:', error);
        next(error);
    }
});

// Rota para atualizar uma avaliação existente (ADMIN) - Admin pode querer corrigir nota ou comentário
app.put('/admin/avaliacoes/:id', adminAuthMiddleware, async (req, res, next) => {
    console.log(`[BACKEND] Recebida requisição PUT /admin/avaliacoes/${req.params.id}`);
    const { id } = req.params;
    const { nota, comentario } = req.body; // Admin só pode atualizar nota e comentário

     if (!mongoose.Types.ObjectId.isValid(id)) {
          console.warn(`[BACKEND] Atualizar Avaliação: ID inválido recebido: ${id}`);
          return res.status(400).json({ message: 'ID de avaliação inválido.' });
     }

    const { error, value } = validateAvaliacao({ nota, comentario }); // Reutiliza validação de avaliação
    if (error) {
        console.error("[BACKEND] ADMIN: Erro de validação Joi ao atualizar avaliação:", error.details);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const avaliacao = await Avaliacao.findById(id);
        if (!avaliacao) {
            console.warn(`[BACKEND] Avaliação ${id} não encontrada para atualização.`);
            return res.status(404).json({ message: 'Avaliação não encontrada.' });
        }

        // Atualiza os campos permitidos
        if (value.nota !== undefined) avaliacao.nota = value.nota;
        if (value.comentario !== undefined) avaliacao.comentario = value.comentario;

        await avaliacao.save();

        console.log(`[BACKEND] ADMIN: Avaliação ${id} atualizada com sucesso.`);
        res.status(200).json({ message: 'Avaliação atualizada com sucesso!', avaliacao });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao atualizar avaliação:', error);
        next(error);
    }
});

// Rota para deletar uma avaliação (ADMIN)
app.delete('/admin/avaliacoes/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        console.log(`[BACKEND] Recebida requisição DELETE /admin/avaliacoes/${req.params.id}`);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`[BACKEND] Deletar Avaliação: ID inválido recebido: ${id}`);
            return res.status(400).json({ message: 'ID de avaliação inválido.' });
        }

        const avaliacaoDeletada = await Avaliacao.findByIdAndDelete(id);

        if (!avaliacaoDeletada) {
            console.warn(`[BACKEND] Avaliação ${id} não encontrada para exclusão.`);
            return res.status(404).json({ message: 'Avaliação não encontrada.' });
        }

         // Opcional: Atualizar o status do serviço associado de volta para 'concluido_pelo_prestador'
         // se a avaliação for deletada, para permitir que o cliente avalie novamente.
         // Isso depende da sua regra de negócio.
         // await Servico.findByIdAndUpdate(avaliacaoDeletada.pedido_servico_id, { status: 'concluido_pelo_prestador' });


        console.log(`[BACKEND] ADMIN: Avaliação ${id} deletada com sucesso.`);
        res.status(200).json({ message: 'Avaliação deletada com sucesso!' });

    } catch (error) {
        console.error('[BACKEND] ADMIN: Erro ao deletar avaliação:', error);
        next(error);
    }
});


// --- FIM NOVAS ROTAS PARA O DASHBOARD ADMIN ---


// --- Middleware para lidar com rotas não encontradas (404) ---
app.use((req, res, next) => {
    console.warn(`[BACKEND] Rota não encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'Rota não encontrada.' });
});


// --- Middleware de tratamento de erros geral ---
app.use((err, req, res, next) => {
    console.error('[BACKEND] Erro interno no servidor:', err.stack);

    if (err instanceof multer.MulterError) {
        console.error('[BACKEND] Erro do Multer:', err.message);
        // Tenta excluir o arquivo temporário em caso de erro no upload
        if (req.file) {
             const filePath = path.join(__dirname, req.file.path);
             fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, unlinkErr);
             });
        } else if (req.files && req.files.length > 0) {
             req.files.forEach(file => {
                  const filePath = path.join(__dirname, file.path);
                  fs.unlink(filePath, (unlinkErr) => {
                     if (unlinkErr) console.error(`[BACKEND] Erro ao excluir arquivo temporário ${filePath}:`, unlinkErr);
                  });
             });
        }
        return res.status(400).json({ message: 'Erro no upload do arquivo: ' + err.message });
    }

    // Erros de validação Joi (já tratados nas rotas, mas como fallback)
    if (Joi.isError(err)) {
         console.error('[BACKEND] Erro de validação Joi (fallback):', err.details);
         return res.status(400).json({ message: err.details[0].message });
    }

    // Erros de conexão com o MongoDB
    if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
         console.error('[BACKEND] Erro de conexão com MongoDB:', err.message);
         return res.status(503).json({ message: 'Erro de conexão com o banco de dados.' });
    }

    // Erros de duplicação (E11000)
    if (err.code === 11000) {
         const field = Object.keys(err.keyValue)[0];
         const value = err.keyValue[field];
         console.error(`[BACKEND] Erro de duplicação: Campo '${field}' com valor '${value}' já existe.`);
         return res.status(400).json({ message: `O valor '${value}' para o campo '${field}' já existe.` });
    }

    // Erros de validação do Mongoose (ex: campos required faltando)
    if (err.name === 'ValidationError') {
         const messages = Object.values(err.errors).map(val => val.message);
         console.error('[BACKEND] Erro de validação do Mongoose:', messages);
         return res.status(400).json({ message: messages.join(', ') });
    }

     // Erros de Cast (IDs inválidos, por exemplo)
     if (err.name === 'CastError') {
          console.error(`[BACKEND] Erro de Cast: Valor inválido para o tipo ${err.kind} no caminho ${err.path}. Valor: ${err.value}`);
          return res.status(400).json({ message: `Valor inválido para o campo ${err.path}.` });
     }


    // Outros erros não tratados
    res.status(err.status || 500).json({
        message: err.message || 'Ocorreu um erro interno no servidor.',
        // Em produção, evite enviar o stack trace completo para o cliente por segurança
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
