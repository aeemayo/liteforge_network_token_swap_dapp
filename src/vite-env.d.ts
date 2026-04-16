/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SWAP_CONTRACT_ADDRESS?: string;
	readonly VITE_LITEFORGE_CHAIN_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
