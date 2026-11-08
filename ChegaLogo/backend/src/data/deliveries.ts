
export type DeliveryStatus =
  | "PENDENTE"
  | "EM_TRANSITO"
  | "ENTREGUE"
  | "ATRASADA";

export interface Delivery {
  id: number;
  trackingCode: string;
  recipient: string;
  origin: string;
  destination: string;
  driver: string;
  status: DeliveryStatus;
  estimatedDelivery: string;
  createdAt: string;
  observations: string;
}

export const deliveries: Delivery[] = [
  {
    id: 1,
    trackingCode: "CHG20260001",
    recipient: "Empresa Alpha",
    origin: "Erechim - RS",
    destination: "Porto Alegre - RS",
    driver: "João Silva",
    status: "EM_TRANSITO",
    estimatedDelivery: "2026-11-12",
    createdAt: "2026-11-06",
    observations: "Carga com equipamentos eletrônicos.",
  },
  {
    id: 2,
    trackingCode: "CHG20260002",
    recipient: "Comercial Beta",
    origin: "Erechim - RS",
    destination: "Chapecó - SC",
    driver: "Maria Oliveira",
    status: "ENTREGUE",
    estimatedDelivery: "2026-11-07",
    createdAt: "2026-11-05",
    observations: "Entrega concluída com sucesso.",
  },
  {
    id: 3,
    trackingCode: "CHG20260003",
    recipient: "Distribuidora Gama",
    origin: "Passo Fundo - RS",
    destination: "Curitiba - PR",
    driver: "Pedro Santos",
    status: "ATRASADA",
    estimatedDelivery: "2026-11-06",
    createdAt: "2026-11-03",
    observations: "Aguardando atualização logística.",
  },
  {
    id: 4,
    trackingCode: "CHG20260004",
    recipient: "Indústria Delta",
    origin: "Erechim - RS",
    destination: "Caxias do Sul - RS",
    driver: "Ana Costa",
    status: "PENDENTE",
    estimatedDelivery: "2026-11-14",
    createdAt: "2026-11-08",
    observations: "Aguardando coleta da mercadoria.",
  },
  {
    id: 5,
    trackingCode: "CHG20260005",
    recipient: "Mercado Central",
    origin: "Chapecó - SC",
    destination: "Florianópolis - SC",
    driver: "Carlos Ferreira",
    status: "EM_TRANSITO",
    estimatedDelivery: "2026-11-11",
    createdAt: "2026-11-07",
    observations: "Mercadoria em deslocamento.",
  },
];
