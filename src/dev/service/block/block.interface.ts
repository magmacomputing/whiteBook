export interface BlockBase {
	index: number;
	data: any;
	prior: string;
}

export interface Block extends BlockBase {
	hash: string;
}

export interface BlockPrev {
	index: number;
	hash: string;
}