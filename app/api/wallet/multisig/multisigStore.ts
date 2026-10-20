export interface MultisigSignature {
  publicKey: string;
  signature: string;
  signedAt: string;
}

export interface PendingMultisigTx {
  id: string;
  sourceAccount: string;
  xdr: string;
  memo?: string;
  proposedBy: string;
  signers: string[];
  signatures: MultisigSignature[];
  requiredWeight: number;
  currentWeight: number;
  status: "pending" | "ready" | "submitted" | "rejected";
  txHash?: string;
  createdAt: string;
}

class MultisigStore {
  private transactions: Map<string, PendingMultisigTx> = new Map();

  constructor() {
    // Seed with an example transaction for demonstration if empty
  }

  getAll(): PendingMultisigTx[] {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id: string): PendingMultisigTx | undefined {
    return this.transactions.get(id);
  }

  getBySigner(signerAddress: string): PendingMultisigTx[] {
    return this.getAll().filter(
      (tx) =>
        tx.signers.some((s) => s.toLowerCase() === signerAddress.toLowerCase()) ||
        tx.sourceAccount.toLowerCase() === signerAddress.toLowerCase() ||
        tx.proposedBy.toLowerCase() === signerAddress.toLowerCase()
    );
  }

  create(data: Omit<PendingMultisigTx, "id" | "signatures" | "currentWeight" | "status" | "createdAt">): PendingMultisigTx {
    const id = `ms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx: PendingMultisigTx = {
      ...data,
      id,
      signatures: [],
      currentWeight: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(id, tx);
    return tx;
  }

  addSignature(txId: string, publicKey: string, signature: string, weight = 1): PendingMultisigTx | null {
    const tx = this.transactions.get(txId);
    if (!tx) return null;

    const alreadySigned = tx.signatures.some((s) => s.publicKey === publicKey);
    if (!alreadySigned) {
      tx.signatures.push({
        publicKey,
        signature,
        signedAt: new Date().toISOString(),
      });
      tx.currentWeight += weight;
    }

    if (tx.currentWeight >= tx.requiredWeight) {
      tx.status = "ready";
    }

    return tx;
  }

  markSubmitted(txId: string, txHash: string): PendingMultisigTx | null {
    const tx = this.transactions.get(txId);
    if (!tx) return null;
    tx.status = "submitted";
    tx.txHash = txHash;
    return tx;
  }
}

export const multisigStore = new MultisigStore();
