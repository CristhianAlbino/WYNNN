# Segurança

## Segredos e variáveis de ambiente

Nunca faça commit de arquivos `.env`, tokens, senhas ou chaves privadas. O arquivo `backend/.env.example` documenta somente os nomes das variáveis necessárias.

Caso uma credencial real seja exposta, revogue-a no provedor correspondente antes de qualquer outra ação.

## Pontos de atenção do código legado

O projeto foi desenvolvido ao longo de várias versões e ainda merece revisão antes de uso em produção.

Em especial:

- remova qualquer fallback previsível para segredos de JWT;
- valide CORS por ambiente;
- revise limites de upload e tipos aceitos pelo Multer;
- aplique rate limiting em autenticação e endpoints públicos;
- revise autorização por papel em rotas administrativas;
- evite retornar dados sensíveis em respostas e logs;
- mantenha MongoDB, Mercado Pago, Twilio, e-mail e Gemini exclusivamente via variáveis de ambiente.

## Relato de vulnerabilidades

Não publique credenciais ou detalhes sensíveis em Issues públicas. Em um projeto ativo, prefira um canal privado para comunicação de vulnerabilidades.
