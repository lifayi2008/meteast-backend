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

  async listBanner(location: string): Promise<CommonResponse> {
    const data = await this.connection
      .collection('banners')
      .find({ location, active: 1, status: '1' })
      .sort({ sort: 1 })
      .project({ _id: 0 })
      .toArray();
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
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
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection
      .collection('token_views')
      .replaceOne({ tokenId, address }, { address, tokenId }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('token_views_likes')
        .updateOne({ tokenId }, { $inc: { views: 1 } }, { upsert: true });
    }
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async incBlindBoxViews(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_views')
      .replaceOne({ blindBoxIndex, address }, { blindBoxIndex, address }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('blind_box_views_likes')
        .updateOne({ blindBoxIndex }, { $inc: { views: 1 } }, { upsert: true });
    }
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async incTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection
      .collection('token_likes')
      .replaceOne({ tokenId, address }, { address, tokenId }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('token_views_likes')
        .updateOne({ tokenId }, { $inc: { likes: 1 } }, { upsert: true });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async incBlindBoxLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_likes')
      .replaceOne({ blindBoxIndex, address }, { blindBoxIndex, address }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('blind_box_views_likes')
        .updateOne({ blindBoxIndex }, { $inc: { likes: 1 } }, { upsert: true });
    }
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async decTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection.collection('token_likes').deleteOne({ tokenId, address });

    if (result.deletedCount === 1) {
      await this.connection
        .collection('token_views_likes')
        .updateOne({ tokenId }, { $inc: { likes: -1 } });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async decBlindBoxLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_likes')
      .deleteOne({ blindBoxIndex, address });

    if (result.deletedCount === 1) {
      await this.connection
        .collection('blind_box_views_likes')
        .updateOne({ blindBoxIndex }, { $inc: { likes: -1 } });
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }
}
