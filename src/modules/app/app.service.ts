import { HttpStatus, Injectable } from '@nestjs/common';
import { CommonResponse } from '../common/interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Constants } from '../common/constants';
import { User } from './interfaces';
import { AuthService } from '../auth/auth.service';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async listBanner(location: string): Promise<CommonResponse> {
    const data = await this.connection
      .collection('banners')
      .find({ location, active: 1, status: '1' })
      .sort({ sort: 1 })
      .project({ _id: 0 })
      .toArray();
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async onOffSale(tokenId: string, operation: string) {
    if (operation === 'onSale') {
      await this.connection
        .collection('token_on_order')
        .updateOne({ tokenId }, { $set: { tokenId } }, { upsert: true });
    } else {
      await this.connection.collection('token_on_order').deleteOne({ tokenId });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async login(user: User): Promise<CommonResponse> {
    const { address, ...rest } = user;
    await this.connection
      .collection('users')
      .updateOne({ address }, { $set: rest }, { upsert: true });

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: await this.authService.login(user),
    };
  }

  async incTokenViews(viewOrLikeDTO: ViewOrLikeDTO) {
    const { did, tokenId, blindBoxIndex } = viewOrLikeDTO;
    if (tokenId) {
      await this.connection
        .collection('token_views')
        .replaceOne({ tokenId, did }, { did, tokenId, isTokenId: 1 }, { upsert: true });
    } else {
      await this.connection
        .collection('token_views')
        .replaceOne({ blindBoxIndex, did }, { did, blindBoxIndex, isTokenId: 0 }, { upsert: true });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async incTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { did, tokenId, blindBoxIndex } = viewOrLikeDTO;
    if (tokenId) {
      await this.connection
        .collection('token_likes')
        .replaceOne({ tokenId, did }, { did, tokenId, isTokenId: 1 }, { upsert: true });
    } else {
      await this.connection
        .collection('token_likes')
        .replaceOne({ blindBoxIndex, did }, { did, blindBoxIndex, isTokenId: 0 }, { upsert: true });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async decTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { did, tokenId, blindBoxIndex } = viewOrLikeDTO;

    await this.connection.collection('token_likes').deleteOne({
      $or: [
        { tokenId, did },
        { blindBoxIndex, did },
      ],
    });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }
}
