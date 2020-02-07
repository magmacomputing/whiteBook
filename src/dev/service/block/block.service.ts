import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { IBlockPrev, IBlockBase, IBlock } from '@service/block/block.interface';

import { cryptoHash } from '@lib/crypto.library';
import { dbg } from '@lib/logger.library';

/**
 * BlockChain service for wrapping Payment / Attend transactions
 */
@Injectable({ providedIn: DBaseModule })
export class BlockService {
  dbg = dbg(this);
  public chain!: Block[];
  private prev: IBlockPrev;

  constructor() {
    this.prev = { index: -1, hash: '0' };
    this.next('genesis')
      .then(block => this.chain = [block]);
  }

  private async block(data: any) {
    const base: IBlockBase = { index: this.prev.index, data, prior: this.prev.hash };
    return new Block(base.index, data, await this.hash(base), base.prior);
  }

  async next(data: any) {
    const block = await this.block(data);

    this.prev = { index: this.prev.index++, hash: block.hash };
    return block;
  }

  async valid(thisBlock: IBlock, prevBlock: IBlock) {
    if (prevBlock.index != thisBlock.index + 1) {
      this.dbg('valid: Invalid Index');
      return false;
    }
    if (prevBlock.hash !== thisBlock.prior) {
      this.dbg('valid: Invalid Prior Hash');
      return false;
    }
    if (thisBlock.hash !== await this.hash(thisBlock)) {
      this.dbg('valid: Invalid Hash');
      return false;
    }
    return true;
  }

  private hash(block: IBlockBase) {
    return cryptoHash(`${block.index}.${block.data}.${block.prior}`);
  }

  private last() {
    return {} as IBlock;
  }
}

class Block {
  constructor(public readonly index: number,
    public readonly data: any,
    public readonly hash: string,
    public readonly prior: string) {
    this.hash = hash;
    this.prior = prior.toString();
  }
}
