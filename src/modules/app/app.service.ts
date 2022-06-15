import { HttpStatus, Injectable } from '@nestjs/common';
import { CommonResponse, MyTokenType, OrderType } from '../common/interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Constants } from '../common/constants';
import { User } from '../common/interfaces';
import { AuthService } from '../auth/auth.service';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';
import { UserProfileDTO } from './dto/UserProfileDTO';
import { TokenQueryDTO } from './dto/TokenQueryDTO';
import { QueryByAddressDTO } from './dto/QueryByAddressDTO';
import { SubService } from './sub.service';

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

    pipeline.push(
      ...[
        { $sort: { createTime: -1 } },
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
        {
          $lookup: { from: 'tokens', localField: 'tokenId', foreignField: 'tokenId', as: 'token' },
        },
        { $unwind: '$token' },
      ],
    );

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

    const result = await this.connection
      .collection('orders')
      .aggregate([...pipeline, { $count: 'total' }])
      .toArray();

    const total = result.length > 0 ? result[0].total : 0;
    let data = [];

    if (total > 0) {
      data = await this.connection
        .collection('orders')
        .aggregate([
          ...pipeline,
          {
            $project: {
              _id: 0,
              token_order: 0,
              'token._id': 0,
              'token.tokenId': 0,
              'token.blockNumber': 0,
            },
          },
          { $sort: SubService.composeOrderClauseForMarketToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listOwnedTokensByAddress(dto: QueryByAddressDTO) {
    const address = dto.address;

    const pipeline = [
      {
        $lookup: {
          from: 'token_on_order',
          let: { tokenId: '$tokenId' },
          pipeline: [
            { $sort: { blockNumber: -1 } },
            { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $match: { $expr: { $eq: ['$tokenId', '$$tokenId'] } } },
            { $project: { _id: 0, tokenId: 0 } },
          ],
          as: 'token_orders',
        },
      },
      { $project: { _id: 0 } },
      {
        $match: {
          $or: [
            { $and: [{ token_orders: { $size: 0 } }, { royaltyOwner: address }] },
            { $and: [{ 'token_orders.count': 1 }, { 'token_orders.from': address }] },
            { $and: [{ 'token_orders.count': 0 }, { 'token_orders.to': address }] },
          ],
        },
      },
      {
        $lookup: {
          from: 'orders',
          let: { tokenId: '$tokenId' },
          pipeline: [
            { $sort: { createTime: -1 } },
            { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $match: { $expr: { $eq: ['$tokenId', '$$tokenId'] } } },
            { $project: { _id: 0, tokenId: 0 } },
          ],
          as: 'orders',
        },
      },
    ];

    const result = await this.connection
      .collection('tokens')
      .aggregate([...pipeline, { $count: 'total' }])
      .toArray();

    const total = result.length > 0 ? result[0].total : 0;
    let data = [];

    if (total > 0) {
      data = await this.connection
        .collection('tokens')
        .aggregate([
          ...pipeline,
          { $sort: SubService.composeOrderClauseForMyToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listCreatedTokensByAddress(dto: QueryByAddressDTO) {
    const royaltyOwner = dto.address;

    const pipeline = [
      { $match: { royaltyOwner } },
      {
        $lookup: {
          from: 'orders',
          let: { tokenId: '$tokenId' },
          pipeline: [
            { $sort: { createTime: -1 } },
            { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $match: { $expr: { $eq: ['$tokenId', '$$tokenId'] } } },
            { $project: { _id: 0, tokenId: 0 } },
          ],
          as: 'order',
        },
      },
      { $project: { _id: 0 } },
    ];

    const result = await this.connection
      .collection('tokens')
      .aggregate([...pipeline, { $count: 'total' }])
      .toArray();

    const total = result.length > 0 ? result[0].total : 0;
    let data = [];

    if (total > 0) {
      data = await this.connection
        .collection('tokens')
        .aggregate([
          ...pipeline,
          { $sort: SubService.composeOrderClauseForMySoldToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listSellTokensByAddress(dto: QueryByAddressDTO, type: MyTokenType) {
    const orderState = type === MyTokenType.OnSale ? 1 : 2;

    const pipeline = [
      {
        $match: { orderState, seller: dto.address },
      },
      {
        $lookup: {
          from: 'tokens',
          localField: 'tokenId',
          foreignField: 'tokenId',
          as: 'token',
        },
      },
      { $project: { _id: 0, 'token._id': 0 } },
    ];

    const result = await this.connection
      .collection('orders')
      .aggregate([...pipeline, { $count: 'total' }])
      .toArray();

    const total = result.length > 0 ? result[0].total : 0;
    let data = [];

    if (total > 0) {
      data = await this.connection
        .collection('orders')
        .aggregate([
          ...pipeline,
          { $sort: SubService.composeOrderClauseForMySoldToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
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
