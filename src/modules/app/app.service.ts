import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommonResponse, OrderState, OrderType, User } from '../common/interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Constants } from '../common/constants';
import { AuthService } from '../auth/auth.service';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';
import { UserProfileDTO } from './dto/UserProfileDTO';
import { TokenQueryDTO } from './dto/TokenQueryDTO';
import { QueryByAddressDTO } from './dto/QueryByAddressDTO';
import { SubService } from './sub.service';
import { NewBlindBoxDTO } from './dto/NewBlindBoxDTO';
import { BlindBoxQueryDTO } from './dto/BlindBoxQueryDTO';
import { SoldBlindBoxDTO } from './dto/SoldBlindBoxDTO';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async check() {
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async login(user: User): Promise<CommonResponse> {
    const { address, ...rest } = user;
    const data = await this.connection.collection('users').findOne({ address });
    if (!data) {
      await this.connection
        .collection('users')
        .updateOne({ address }, { $set: rest }, { upsert: true });
    } else {
      user = { ...user, ...data };
    }

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: await this.authService.login(user),
    };
  }

  async updateUserProfile(dto: UserProfileDTO, address: string): Promise<CommonResponse> {
    const { name, description, avatar, coverImage } = dto;
    await this.connection
      .collection('users')
      .updateOne({ address }, { $set: { name, description, avatar, coverImage } });

    const user = await this.connection.collection('users').findOne({ address });

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: await this.authService.login(user as unknown as User),
    };
  }

  async getUserProfile(address: string): Promise<CommonResponse> {
    const data = await this.connection.collection('users').findOne({ address });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getNotifications(address) {
    const data = await this.connection
      .collection('notifications')
      .find({ address })
      .project({
        _id: { $toString: '$_id' },
        address: 1,
        orderId: 1,
        type: 1,
        date: 1,
        params: 1,
        read: 1,
      })
      .sort({ date: -1 })
      .toArray();
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async readNotifications(address) {
    await this.connection
      .collection('notifications')
      .updateMany({ address }, { $set: { read: 1 } });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async removeNotification(id: string, address: string) {
    await this.connection
      .collection('notifications')
      .deleteOne({ _id: new mongoose.Types.ObjectId(id), address });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async getUserCandidateTokens(address: string) {
    const data = await this.connection
      .collection('tokens')
      .aggregate([
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
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { royaltyOwner: address, order: { $exists: false } },
              { 'order.orderState': OrderState.Filled, 'order.buyer': address },
              { 'order.orderState': OrderState.Cancelled, 'order.seller': address },
              { 'order.orderState': OrderState.TakenDown, 'order.seller': address },
            ],
          },
        },
        { $sort: { createTime: -1 } },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
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

  async getTokenPriceHistory(pageNum: number, pageSize: number): Promise<CommonResponse> {
    const total = this.connection.collection('orders').count({ orderState: 1 });
    const data = await this.connection
      .collection('orders')
      .aggregate([
        { $match: { orderState: 1 } },
        { $sort: { createTime: -1 } },
        { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        {
          $lookup: { from: 'tokens', localField: 'tokenId', foreignField: 'tokenId', as: 'token' },
        },
        { $unwind: { path: '$token' } },
        { $sort: { 'token.likes': -1, 'token.views': -1 } },
        { $skip: (pageNum - 1) * pageSize },
        { $limit: pageSize },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async getFavoritesCollectible(address: string) {
    const data = await this.connection
      .collection('token_likes')
      .find({ address })
      .project({ _id: 0, tokenId: 1 })
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getFavoritesBlindBox(address: string) {
    const data = await this.connection
      .collection('blind_box_likes')
      .find({ address })
      .project({ _id: 0, blindBoxIndex: 1 })
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async listMarketTokens(dto: TokenQueryDTO) {
    const pipeline = [];
    const match = {
      isBlindBox: false,
      orderState: OrderState.Created,
    };

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match['orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match['orderType'] = OrderType.Auction;
      }
    }

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice * 1e18;
    }
    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice * 1e18;
    }
    if (Object.keys(priceMatch).length > 0) {
      match['orderPrice'] = priceMatch;
    }

    pipeline.push(
      ...[
        { $match: match },
        { $sort: { createTime: -1 } },
        { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
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

  async getMarketTokenByTokenId(tokenId: string) {
    const data = await this.connection
      .collection('tokens')
      .aggregate([
        { $match: { tokenId } },
        {
          $lookup: {
            from: 'orders',
            let: { tokenId: '$tokenId' },
            pipeline: [
              { $sort: { createTime: -1 } },
              { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
              { $replaceRoot: { newRoot: '$doc' } },
              { $match: { $expr: { $eq: ['$tokenId', '$$tokenId'] }, isBlindBox: false } },
              { $project: { _id: 0, tokenId: 0, blockNumberForBuyer: 0, blockNumberForPrice: 0 } },
            ],
            as: 'order',
          },
        },
        { $unwind: { path: '$order' } },
        { $project: { _id: 0 } },
      ])
      .toArray();

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: data.length > 0 ? data[0] : {},
    };
  }

  async getTokenByIds(ids: string[]) {
    const data = await this.connection
      .collection('tokens')
      .find({ tokenId: { $in: ids } })
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async listAllMyTokens(dto: QueryByAddressDTO, allTokens: boolean) {
    const pipeline = [];
    const match = {};

    if (dto.keyword) {
      match['$or'] = [
        { royaltyOwner: dto.keyword },
        { name: { $regex: dto.keyword, $options: 'i' } },
        { description: { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (dto.category) {
      match['category'] = dto.category;
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push(
      ...[
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
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      ],
    );

    const orClause = [];

    if (allTokens) {
      orClause.push({ royaltyOwner: dto.address });
    } else {
      orClause.push({ royaltyOwner: dto.address, order: { $exists: false } });
    }

    orClause.push(
      ...[
        { 'order.orderState': OrderState.Created, 'order.seller': dto.address },
        { 'order.orderState': OrderState.Filled, 'order.buyer': dto.address },
        { 'order.orderState': OrderState.Cancelled, 'order.seller': dto.address },
        { 'order.orderState': OrderState.TakenDown, 'order.seller': dto.address },
      ],
    );

    const match2 = {
      $or: orClause,
    };

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match2['order.orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match2['order.orderType'] = OrderType.Auction;
      }
    }

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice * 1e18;
    }
    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice * 1e18;
    }
    if (Object.keys(priceMatch).length > 0) {
      match2['order.orderPrice'] = priceMatch;
    }

    pipeline.push(...[{ $match: match2 }, { $project: { _id: 0, blockNumber: 0 } }]);

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
          { $sort: SubService.composeOrderClauseForToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listCreatedTokensByAddress(dto: QueryByAddressDTO) {
    const pipeline = [];
    const match = { royaltyOwner: dto.address };

    if (dto.keyword) {
      match['$or'] = [
        { royaltyOwner: dto.keyword },
        { name: { $regex: dto.keyword, $options: 'i' } },
        { description: { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (dto.category) {
      match['category'] = dto.category;
    }

    pipeline.push({ $match: match });

    pipeline.push(
      ...[
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
      ],
    );

    const match2 = {};

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match2['order.orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match2['order.orderType'] = OrderType.Auction;
      }
    }

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice * 1e18;
    }
    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice * 1e18;
    }
    if (Object.keys(priceMatch).length > 0) {
      match2['order.orderPrice'] = priceMatch;
    }

    if (Object.keys(match2).length > 0) {
      pipeline.push({ $match: match2 });
    }

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
          { $sort: SubService.composeOrderClauseForToken(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listSellTokensByAddress(dto: QueryByAddressDTO, orderState: OrderState) {
    const pipeline = [
      { $match: { orderState, seller: dto.address } },
      { $sort: { createTime: -1 } },
      { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $lookup: {
          from: 'tokens',
          localField: 'tokenId',
          foreignField: 'tokenId',
          as: 'token',
        },
      },
      { $unwind: { path: '$token' } },
      { $project: { _id: 0, 'token._id': 0 } },
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
      { $unwind: '$order' },
    ];

    const match = {};
    if (dto.keyword) {
      match['$or'] = [
        { 'token.royaltyOwner': dto.keyword },
        { 'token.name': { $regex: dto.keyword, $options: 'i' } },
        { 'token.description': { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (dto.category) {
      match['token.category'] = dto.category;
    }

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match['order.orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match['order.orderType'] = OrderType.Auction;
      }
    }

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice * 1e18;
    }
    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice * 1e18;
    }
    if (Object.keys(priceMatch).length > 0) {
      match['order.orderPrice'] = priceMatch;
    }

    if (Object.keys(match).length > 0) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      pipeline.push({ $match: match });
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
          { $sort: SubService.composeOrderClauseForFavorite(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async listFavoritesTokens(dto: QueryByAddressDTO, address: string) {
    const pipeline = [
      { $match: { address } },
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
      { $unwind: '$order' },
      {
        $lookup: {
          from: 'tokens',
          localField: 'tokenId',
          foreignField: 'tokenId',
          as: 'token',
        },
      },
      { $unwind: '$token' },
      { $project: { _id: 0, 'token._id': 0, 'token.tokenId': 0, 'token.blockNumber': 0 } },
    ];

    const match = {};
    if (dto.keyword) {
      match['$or'] = [
        { 'token.royaltyOwner': dto.keyword },
        { 'token.name': { $regex: dto.keyword, $options: 'i' } },
        { 'token.description': { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (dto.category) {
      match['token.category'] = dto.category;
    }

    if (dto.filterStatus) {
      if (dto.filterStatus === 'BUY NOW') {
        match['order.orderType'] = OrderType.Sale;
      } else if (dto.filterStatus === 'ON AUCTION') {
        match['order.orderType'] = OrderType.Auction;
      }
    }

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice * 1e18;
    }
    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice * 1e18;
    }
    if (Object.keys(priceMatch).length > 0) {
      match['order.orderPrice'] = priceMatch;
    }

    if (Object.keys(match).length > 0) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      pipeline.push({ $match: match });
    }

    const result = await this.connection
      .collection('token_likes')
      .aggregate([...pipeline, { $count: 'total' }])
      .toArray();

    const total = result.length > 0 ? result[0].total : 0;
    let data = [];

    if (total > 0) {
      data = await this.connection
        .collection('token_likes')
        .aggregate([
          ...pipeline,
          { $sort: SubService.composeOrderClauseForFavorite(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async getMyTokenNumbers(address: string) {
    const liked = await this.connection.collection('token_likes').count({ address });
    const sold = await this.connection
      .collection('orders')
      .count({ orderState: OrderState.Filled, seller: address });
    const forSale = await this.connection
      .collection('orders')
      .count({ orderState: OrderState.Created, seller: address });
    const created = await this.connection.collection('tokens').count({ royaltyOwner: address });

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: { liked, sold, forSale, created },
    };
  }

  async getMyAllTokenNumber(address: string) {
    const result = await this.connection
      .collection('tokens')
      .aggregate([
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
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { royaltyOwner: address },
              { 'order.orderState': OrderState.Created, 'order.seller': address },
              { 'order.orderState': OrderState.Filled, 'order.buyer': address },
              { 'order.orderState': OrderState.Cancelled, 'order.seller': address },
              { 'order.orderState': OrderState.TakenDown, 'order.seller': address },
            ],
          },
        },
        { $count: 'total' },
      ])
      .toArray();

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: result.length > 0 ? result[0].total : 0,
    };
  }

  async getMyOwnedTokenNumber(address: string) {
    const result = await this.connection
      .collection('tokens')
      .aggregate([
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
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { royaltyOwner: address, order: { $exists: false } },
              { 'order.orderState': OrderState.Created, 'order.seller': address },
              { 'order.orderState': OrderState.Filled, 'order.buyer': address },
              { 'order.orderState': OrderState.Cancelled, 'order.seller': address },
              { 'order.orderState': OrderState.TakenDown, 'order.seller': address },
            ],
          },
        },
        { $count: 'total' },
      ])
      .toArray();

    return {
      status: HttpStatus.OK,
      message: Constants.MSG_SUCCESS,
      data: result.length > 0 ? result[0].total : 0,
    };
  }

  async incTokenViews(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection
      .collection('token_views')
      .replaceOne({ tokenId, address }, { address, tokenId }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { views: 1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }
    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async incTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection
      .collection('token_likes')
      .replaceOne({ tokenId, address }, { address, tokenId }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { likes: 1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }

    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async decTokenLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, tokenId } = viewOrLikeDTO;

    const result = await this.connection.collection('token_likes').deleteOne({ tokenId, address });

    if (result.deletedCount === 1) {
      await this.connection.collection('tokens').updateOne({ tokenId }, { $inc: { likes: -1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }

    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async incBlindBoxViews(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_views')
      .replaceOne({ blindBoxIndex, address }, { blindBoxIndex, address }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('blind_box')
        .updateOne({ _id: new mongoose.Types.ObjectId(blindBoxIndex) }, { $inc: { views: 1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }
    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async incBlindBoxLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_likes')
      .replaceOne({ blindBoxIndex, address }, { blindBoxIndex, address }, { upsert: true });

    if (result.upsertedCount === 1) {
      await this.connection
        .collection('blind_box')
        .updateOne({ _id: new mongoose.Types.ObjectId(blindBoxIndex) }, { $inc: { likes: 1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }
    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async decBlindBoxLikes(viewOrLikeDTO: ViewOrLikeDTO) {
    const { address, blindBoxIndex } = viewOrLikeDTO;

    const result = await this.connection
      .collection('blind_box_likes')
      .deleteOne({ blindBoxIndex, address });

    if (result.deletedCount === 1) {
      await this.connection
        .collection('blind_box')
        .updateOne({ _id: new mongoose.Types.ObjectId(blindBoxIndex) }, { $inc: { likes: -1 } });
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
    }

    return { status: HttpStatus.ACCEPTED, message: Constants.MSG_SUCCESS };
  }

  async createBlindBox(dto: NewBlindBoxDTO, user: User) {
    await this.connection.collection('blind_box').insertOne({
      ...dto,
      createTime: Date.now(),
      soldTokenIds: [],
      seller: user.address,
      views: 0,
      likes: 0,
      allSold: 0,
    });

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async listMarketBlindBoxes(dto: BlindBoxQueryDTO) {
    const pipeline = [];
    const match = { allSold: 0 };

    const priceMatch = {};
    if (dto.minPrice) {
      priceMatch['$gte'] = dto.minPrice;
    }

    if (dto.maxPrice) {
      priceMatch['$lte'] = dto.maxPrice;
    }

    if (Object.keys(priceMatch).length > 0) {
      match['blindPrice'] = priceMatch;
    }

    if (dto.keyword) {
      match['$or'] = [
        { seller: dto.keyword },
        { name: { $regex: dto.keyword, $options: 'i' } },
        { description: { $regex: dto.keyword, $options: 'i' } },
      ];
    }

    if (Object.getOwnPropertyNames(match).length > 0) {
      pipeline.push({ $match: match });
    }

    let data = [];
    const total = await this.connection.collection('blind_box').count(match);

    if (total > 0) {
      data = await this.connection
        .collection('blind_box')
        .aggregate([
          { $match: match },
          {
            $project: {
              _id: { $toString: '$_id' },
              address: 1,
              name: 1,
              description: 1,
              asset: 1,
              thumbnail: 1,
              blindPrice: 1,
              saleBegin: 1,
              maxPurchases: 1,
              createTime: 1,
              likes: 1,
              views: 1,
              tokenIds: 1,
              soldTokenIds: 1,
              seller: 1,
            },
          },
          { $sort: SubService.composeOrderClauseForMarketBlindBox(dto.orderType) },
          { $skip: (dto.pageNum - 1) * dto.pageSize },
          { $limit: dto.pageSize },
        ])
        .toArray();
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: { total, data } };
  }

  async selectBlindBoxToken(id: string, count: number) {
    const blindBox = await this.connection
      .collection('blind_box')
      .findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!blindBox) {
      throw new InternalServerErrorException(`Blind box ${id} not found`);
    }

    if (blindBox.tokenIds.length < count) {
      throw new BadRequestException(`Blind box ${id} has only ${blindBox.tokenIds.length} tokens`);
    }

    const selectedTokenIds = [];
    const tokenIds = blindBox.tokenIds;

    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * tokenIds.length);
      selectedTokenIds.push(tokenIds[index]);
      tokenIds.splice(index, 1);
    }

    const data = await this.connection
      .collection('orders')
      .find({
        orderState: OrderState.Created,
        isBlindBox: true,
        tokenId: { $in: selectedTokenIds },
      })
      .project({ _id: 0, orderId: 1 })
      .toArray();

    if (data.length < count) {
      throw new InternalServerErrorException(`Blind box ${id} state exception`);
    }

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async soldTokenFromBlindBox(dto: SoldBlindBoxDTO) {
    const result = await this.connection
      .collection('orders')
      .find({ orderId: { $in: dto.orderIds } })
      .project({ _id: 0, tokenId: 1 })
      .toArray();

    const soldTokenIdsInThisOrder = [];
    result.forEach((item) => {
      soldTokenIdsInThisOrder.push(item.tokenId);
    });

    const blindBox = await this.connection
      .collection('blind_box')
      .findOne({ _id: new mongoose.Types.ObjectId(dto.id) });

    if (!blindBox) {
      throw new InternalServerErrorException(`Blind box ${dto.id} not found`);
    }

    const tokenIds = blindBox.tokenIds.filter((id) => !soldTokenIdsInThisOrder.includes(id));
    const soldTokenIds = blindBox.soldTokenIds.concat(soldTokenIdsInThisOrder);
    const maxPurchases =
      blindBox.maxPurchases < tokenIds.length ? blindBox.maxPurchases : tokenIds.length;
    let allSold = 0;
    if (blindBox.tokenIds.length === 0) {
      allSold = Date.now();
    }

    await this.connection
      .collection('blind_box')
      .updateOne(
        { _id: new mongoose.Types.ObjectId(dto.id) },
        { $set: { tokenIds, soldTokenIds, maxPurchases, allSold } },
      );
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async getMarketBlindBoxByBlindBoxId(id: string) {
    const data = await this.connection
      .collection('blind_box')
      .findOne({ _id: new mongoose.Types.ObjectId(id) });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getNFTFromBlindBox(dto: number[]) {
    const data = await this.connection
      .collection('orders')
      .aggregate([
        { $match: { orderId: { $in: dto }, isBlindBox: true } },
        {
          $lookup: {
            from: 'tokens',
            localField: 'tokenId',
            foreignField: 'tokenId',
            as: 'token',
          },
        },
        { $unwind: '$token' },
        {
          $project: {
            _id: 0,
            name: '$token.name',
            royaltyOwner: '$token.royaltyOwner',
            thumbnail: '$token.thumbnail',
          },
        },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async checkTokenLike(id: string, address: string) {
    const data = await this.connection.collection('token_likes').findOne({ tokenId: id, address });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: !!data };
  }

  async checkBlindBoxLike(id: string, address: string) {
    const data = await this.connection
      .collection('blind_box_likes')
      .findOne({ blindBoxIndex: id, address });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: !!data };
  }
}
