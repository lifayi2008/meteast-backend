import { HttpStatus, Injectable } from '@nestjs/common';
import { CommonResponse, OrderType } from '../common/interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Constants } from '../common/constants';
import { OrderBy, User } from './interfaces';
import { AuthService } from '../auth/auth.service';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';
import { UserProfileDTO } from './dto/UserProfileDTO';
import { TokenQueryDTO } from './dto/TokenQueryDTO';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

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

  async listBanner(location: string): Promise<CommonResponse> {
    const data = await this.connection
      .collection('banners')
      .find({ location, active: 1, status: '1' })
      .sort({ sort: 1 })
      .project({ _id: 0 })
      .toArray();
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getPopularityOfTokens(pageNum: number, pageSize: number): Promise<CommonResponse> {
    const total = this.connection.collection('token_on_order').find({ count: 1 }).bufferedCount();
    const data = await this.connection
      .collection('token_on_order')
      .aggregate([
        { $match: { count: 1 } },
        {
          $lookup: {
            from: 'token_views_likes',
            localField: 'tokenId',
            foreignField: 'tokenId',
            as: 'token',
          },
        },
        { $unwind: '$token' },
        { $sort: { 'token.likes': -1, 'token.views': -1 } },
        { $skip: (pageNum - 1) * pageSize },
        { $limit: pageSize },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async getFavoritesCollectible(pageNum: number, pageSize: number, address) {
    const total = this.connection.collection('token_likes').find({ address }).bufferedCount();
    const data = await this.connection
      .collection('token_likes')
      .find({ address })
      .project({ _id: 0, tokenId: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listMarketTokens(dto: TokenQueryDTO) {
    const pipeline = [];
    const match1 = {};

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match1['orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match1['orderType'] = OrderType.Auction;
      }
    }

    if (dto.minPrice) {
      match1['price'] = { $gte: dto.minPrice };
    }

    if (dto.maxPrice) {
      match1['price'] = { $lte: dto.maxPrice };
    }

    if (Object.getOwnPropertyNames(match1).length > 0) {
      pipeline.push({ $match: match1 });
    }

    pipeline.push([
      { $sort: { blockNumber: -1 } },
      { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $lookup: {
          from: 'token_on_order',
          localField: 'tokenId',
          foreignField: 'tokenId',
          as: 'token_order',
        },
      },
      { $unwind: '$token_order' },
      { $match: { 'token_order.count': 1 } },
      { $lookup: { from: 'tokens', localField: 'tokenId', foreignField: 'tokenId', as: 'token' } },
      { $unwind: '$token' },
    ]);

    const match2 = {};

    if (dto.keyword) {
      match2['$or'] = [
        { 'token.royaltyOwner': dto.keyword },
        { 'token.name': { $regex: dto.keyword, $options: 'i' } },
        { 'token.description': { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (dto.category) {
      match2['token.category'] = dto.category;
    }

    if (Object.getOwnPropertyNames(match2).length > 0) {
      pipeline.push({ $match: match2 });
    }

    const total = (
      await this.connection
        .collection('tokens')
        .aggregate([...pipeline, { $count: 'total' }])
        .toArray()
    )[0].total;

    const data = await this.connection
      .collection('tokens')
      .aggregate([
        ...pipeline,
        { $project: { _id: 0, tokenId: 1 } },
        { $sort: AppService.composeOrderClause(dto.orderType) },
        { $skip: (dto.pageNum - 1) * dto.pageSize },
        { $limit: dto.pageSize },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  private static composeOrderClause(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { orderPrice: -1 };
      case OrderBy.PriceLTH:
        return { orderPrice: 1 };
      case OrderBy.MOST_VIEWED:
        return { 'token.views': -1 };
      case OrderBy.MOST_LIKED:
        return { 'token.likes': -1 };
      case OrderBy.MOST_RECENT:
        return { blockNumber: -1 };
      case OrderBy.OLDEST:
        return { blockNumber: 1 };
      default:
        return { blockNumber: -1 };
    }
  }

  async incTokenViews(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection
      .collection('token_views')
      .replaceOne({ tokenId, address }, { address, tokenId }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { views: 1 } });
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
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { likes: 1 } });
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
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { likes: -1 } });
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

  async updateUserProfile(dto: UserProfileDTO, address: string): Promise<CommonResponse> {
    const { name, description, avatar, coverImage } = dto;
    await this.connection.collection('users').updateOne(
      { address },
      {
        $set: {
          name,
          description,
          avatar,
          coverImage,
        },
      },
    );
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async getUserProfile(address: string): Promise<CommonResponse> {
    const data = await this.connection.collection('users').findOne({ address });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }
}
