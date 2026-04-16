/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SWAP_CONTRACT_ADDRESS?: string;
	readonly VITE_LITEFORGE_CHAIN_ID?: string;
	readonly VITE_EXPLORER_TX_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
