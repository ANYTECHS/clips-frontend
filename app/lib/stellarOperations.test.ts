import {
    createAddSignerOp,
    createMultisigThresholdsOp,
    validateOperations,
} from "@/app/lib/stellarOperations";

describe("stellarOperations multisig helpers", () => {
    it("creates a valid add signer operation", () => {
        const op = createAddSignerOp({
            ed25519PublicKey: "GABCDEF1234567890",
            weight: 1,
            source: "GSRCPUBKEY1234567890",
        });

        expect(op.type).toBe("set_options");
        expect(op.signer).toEqual({ ed25519PublicKey: "GABCDEF1234567890", weight: 1 });
        expect(op.source).toBe("GSRCPUBKEY1234567890");
    });

    it("creates a valid multisig thresholds operation", () => {
        const op = createMultisigThresholdsOp({
            lowThreshold: 1,
            medThreshold: 2,
            highThreshold: 2,
            masterWeight: 1,
            source: "GSRCPUBKEY1234567890",
        });

        expect(op.type).toBe("set_options");
        expect(op.lowThreshold).toBe(1);
        expect(op.medThreshold).toBe(2);
        expect(op.highThreshold).toBe(2);
        expect(op.masterWeight).toBe(1);
        expect(op.source).toBe("GSRCPUBKEY1234567890");
    });

    it("validates multisig operations as valid set_options entries", () => {
        const ops = [
            createAddSignerOp({
                ed25519PublicKey: "GABCDEF1234567890",
                weight: 1,
            }),
            createMultisigThresholdsOp({
                lowThreshold: 1,
                medThreshold: 2,
                highThreshold: 2,
                masterWeight: 1,
            }),
        ];

        expect(() => validateOperations(ops)).not.toThrow();
    });
});
