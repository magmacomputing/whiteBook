export interface IBlockBase {
	index: number;
	data: any;
	prior: string;
}

export interface IBlock extends IBlockBase {
	hash: string;
}

export interface IBlockPrev {
	index: number;
	hash: string;
}