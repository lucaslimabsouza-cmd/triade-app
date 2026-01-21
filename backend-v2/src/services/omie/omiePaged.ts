import { callOmie } from "./callOmie";

type PagedResult<T> = {
  items: T[];
  pages: number;
};

function pickArray(obj: any): any[] {
  if (!obj || typeof obj !== "object") return [];
  // Omie costuma devolver listas com nomes diferentes, então tentamos achar a lista automaticamente
  const candidates = [
    "categoria_cadastro",
    "cliente_cadastro",
    "projeto_cadastro",
    "conta_pagar_cadastro",
    "movimentos",
    "lista",
    "registros",
    "cadastros",
    "dados",
  ];
  for (const k of candidates) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  // fallback: pega o primeiro array que encontrar
  for (const k of Object.keys(obj)) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  return [];
}

function getTotalPages(obj: any): number {
  const n = Number(obj?.total_de_paginas ?? obj?.total_de_paginas ?? obj?.totalPaginas ?? obj?.total_pages);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function omieFetchAllPaged<T = any>(opts: {
  endpointPath: string;   // ex: "/geral/categorias/"
  call: string;           // ex: "ListarCategorias"
  baseParams: Record<string, any>; // ex: { pagina: 1, registros_por_pagina: 200, ... }
  maxPages?: number;      // segurança
}): Promise<PagedResult<T>> {
  const maxPages = opts.maxPages ?? 200; // segurança
  const items: T[] = [];

  // primeira página
  const first = await callOmie(opts.endpointPath, opts.call, [{
    ...opts.baseParams,
    pagina: 1,
  }]);

  const firstItems = pickArray(first) as T[];
  items.push(...firstItems);

  const totalPages = Math.min(getTotalPages(first), maxPages);

  // demais páginas
  for (let p = 2; p <= totalPages; p++) {
    const resp = await callOmie(opts.endpointPath, opts.call, [{
      ...opts.baseParams,
      pagina: p,
    }]);
    const pageItems = pickArray(resp) as T[];
    items.push(...pageItems);
  }

  return { items, pages: totalPages };
}
