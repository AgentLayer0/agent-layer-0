import { useUsageStats, useRelayTransactions, type RelayTransaction } from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const ALGOEXPLORER_TX = "https://testnet.algoexplorer.io/tx";

const TX_TYPE_LABELS: Record<string, string> = {
  register: "REGISTER SWARM",
  poll: "CREATE POLL",
  init_poll: "INIT POLL",
  vote: "CAST VOTE",
};

function TxRow({ tx, index }: { tx: RelayTransaction; index: number }) {
  return (
    <Card
      className="bg-card border-card-border hover:border-primary/30 transition-colors"
      data-testid={`tx-row-${index}`}
    >
      <CardContent className="p-3">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 items-center">
          <a
            href={`${ALGOEXPLORER_TX}/${tx.algoTxId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-primary hover:underline truncate"
            data-testid={`link-tx-${index}`}
            title={tx.algoTxId}
          >
            {tx.algoTxId.slice(0, 8)}…{tx.algoTxId.slice(-6)} ↗
          </a>
          <span className="text-xs font-mono text-muted-foreground">
            {TX_TYPE_LABELS[tx.txType] ?? tx.txType.toUpperCase()}
          </span>
          <span
            className={`text-xs font-mono ${
              tx.status === "confirmed"
                ? "text-green-400"
                : "text-yellow-400"
            }`}
          >
            {tx.status.toUpperCase()}
          </span>
          <span className="text-xs font-mono text-muted-foreground text-right">
            {format(new Date(tx.createdAt), "MM/dd HH:mm")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TransactionsPage() {
  const { data: stats, isLoading: statsLoading } = useUsageStats();
  const { data: txs, isLoading: txsLoading, isError, error } = useRelayTransactions(25);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground mb-2">
            RELAY.TRANSACTIONS
          </h1>
          <p className="text-muted-foreground">
            On-chain activity submitted via AL0
          </p>
        </div>

        {statsLoading ? (
          <Skeleton className="h-12 w-48" />
        ) : stats ? (
          <div className="text-right">
            <div
              className="text-2xl font-mono font-bold text-primary"
              data-testid="text-total-tx"
            >
              {stats.txCount.toLocaleString()} TXS
            </div>
            <div className="text-xs text-muted-foreground uppercase font-mono">
              {stats.estimatedAlgoSpent.toFixed(6)} ALGO SPENT
            </div>
          </div>
        ) : null}
      </div>

      {isError ? (
        <div
          className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md font-mono text-sm"
          data-testid="error-banner"
        >
          Failed to load transactions: {String((error as Error).message)}
        </div>
      ) : txsLoading ? (
        <div className="space-y-2" data-testid="txs-loading">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : txs && txs.length > 0 ? (
        <div data-testid="txs-table">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider border-b border-card-border mb-1">
            <span>ALGO TX ID</span>
            <span>TYPE</span>
            <span>STATUS</span>
            <span className="text-right">TIME</span>
          </div>
          <div className="space-y-1">
            {txs.map((tx, i) => (
              <TxRow key={tx.id} tx={tx} index={i} />
            ))}
          </div>
        </div>
      ) : txs && txs.length === 0 ? (
        <Card className="bg-card border-card-border border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="font-mono text-muted-foreground/50 border border-muted-foreground/20 rounded p-4 mb-2">
              {"< / >"}
            </div>
            <h3 className="font-mono text-lg font-bold text-foreground">
              NO RELAY ACTIVITY YET
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Transactions submitted through the AL0 relay will appear here
              with AlgoExplorer links.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
