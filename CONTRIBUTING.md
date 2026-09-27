# Contribuindo

## Fluxo

1. Crie uma branch a partir de `master`.
2. Faça alterações pequenas e bem descritas.
3. Rode as validações disponíveis.
4. Não versione `node_modules`, uploads de usuários ou arquivos `.env`.
5. Abra um Pull Request explicando o que mudou e como testar.

## Backend

```bash
cd backend
npm ci
npm run check
```

## Frontend

Ao alterar páginas, teste os fluxos relacionados e verifique o console do navegador. O projeto ainda contém páginas legadas; evite renomear arquivos sem corrigir todos os links correspondentes.
