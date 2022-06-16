import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { CommonResponse, OrderState, User, UserType } from '../common/interfaces';
import { DIDBackend, VerifiablePresentation } from '@elastosfoundation/did-js-sdk';
import { MyDIDAdapter } from './did.adapter';
import { Constants } from '../common/constants';
import { LoginDTO } from './dto/LoginDTO';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';
import { UserProfileDTO } from './dto/UserProfileDTO';
import Web3 from 'web3';
import { TokenQueryDTO } from './dto/TokenQueryDTO';
import { QueryPageDTO } from '../common/QueryPageDTO';
import { QueryByAddressDTO } from './dto/QueryByAddressDTO';

@Controller()
export class AppController {
  private readonly logger = new Logger('AppController');

  private user: any;
  constructor(private readonly appService: AppService) {
    DIDBackend.initialize(new MyDIDAdapter());
  }

  @Post('/login')
  async login(@Body() loginDto: LoginDTO): Promise<CommonResponse> {
    if (!loginDto.address || loginDto.address.length !== Constants.ADDRESS_LENGTH) {
      throw new BadRequestException('Invalid Request Params');
    }

    const user: User = { address: loginDto.address, role: UserType.User };

    if (loginDto.isMetaMask === 1) {
      user.name = loginDto.name;
      user.avatar = loginDto.avatar;
      user.description = loginDto.description;
    } else if (loginDto.presentation !== undefined) {
      const vp = VerifiablePresentation.parse(loginDto.presentation);
      if (!(await vp.isValid())) {
        throw new BadRequestException('Invalid presentation');
      }
      const did = vp.getHolder().toString();
      if (!did) {
        throw new BadRequestException('Invalid presentation');
      }
      user.did = did;

      const nameCredential = vp.getCredential(`name`);
      user.name = nameCredential ? nameCredential.getSubject().getProperty('name') : '';

      const avatarCredential = vp.getCredential(`avatar`);
      user.avatar = avatarCredential ? avatarCredential.getSubject().getProperty('avatar') : '';

      const descriptionCredential = vp.getCredential(`description`);
      user.description = descriptionCredential
        ? descriptionCredential.getSubject().getProperty('description')
        : '';
    } else {
      throw new BadRequestException('Invalid Request Params');
    }

    return await this.appService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/updateUserProfile')
  async updateUserProfile(@Body() dto: UserProfileDTO, @Request() req): Promise<CommonResponse> {
    const address = new Web3().eth.accounts.recover(
      `Update profile with ${dto.did}`,
      dto.signature,
    );
    if (address !== req.user.address) {
      throw new BadRequestException('Invalid Request Params');
    }

    return await this.appService.updateUserProfile(dto, req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/getUserProfile')
  async getUserProfile(@Request() req): Promise<CommonResponse> {
    return await this.appService.getUserProfile(req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/getNotifications')
  async getNotifications(@Request() req): Promise<CommonResponse> {
    return await this.appService.getNotifications(req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/readNotifications')
  async readNotifications(@Request() req): Promise<CommonResponse> {
    return await this.appService.readNotifications(req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/removeNotification')
  async removeNotification(@Query('id') id: string, @Request() req): Promise<CommonResponse> {
    return await this.appService.removeNotification(id, req.user.address);
  }

  @Get('/listBanner')
  async listBanner(@Query('location') location: string): Promise<CommonResponse> {
    return await this.appService.listBanner(location);
  }

  @Post('/getPopularityOfTokens')
  async getPopularityOfTokens(@Body() dto: QueryPageDTO): Promise<CommonResponse> {
    return await this.appService.getPopularityOfTokens(dto.pageNum, dto.pageSize);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/getFavoritesCollectible')
  async getFavoritesCollectible(@Request() req): Promise<CommonResponse> {
    return await this.appService.getFavoritesCollectible(req.user.address);
  }

  @Post('/listMarketTokens')
  async listMarketTokens(@Body() dto: TokenQueryDTO): Promise<CommonResponse> {
    return await this.appService.listMarketTokens(dto);
  }

  @Post('/listAllMyTokens')
  async listAllMyTokens(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listAllMyTokens(dto);
  }

  @Post('/listOwnedTokensByAddress')
  async listOwnedTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listOwnedTokensByAddress(dto);
  }

  @Post('/listCreatedTokensByAddress')
  async listCreatedTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listCreatedTokensByAddress(dto);
  }

  @Post('/listSaleTokensByAddress')
  async listSaleTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listSellTokensByAddress(dto, OrderState.Created);
  }

  @Post('/listSoldTokensByAddress')
  async listSoldTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listSellTokensByAddress(dto, OrderState.Filled);
  }

  @Get('/getMyTokenNumbers')
  async getMyTokenNumbers(@Query('address') address: string): Promise<CommonResponse> {
    return await this.appService.getMyTokenNumbers(address);
  }

  @Get('/getMyAllTokenNumber')
  async getMyAllTokenNumber(@Query('address') address: string): Promise<CommonResponse> {
    return await this.appService.getMyAllTokenNumber(address);
  }

  @Get('/getMyOwnedTokenNumber')
  async getMyOwnedTokenNumber(@Query('address') address: string): Promise<CommonResponse> {
    return await this.appService.getMyOwnedTokenNumber(address);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/listFavoritesTokens')
  async getFavoritesTokens(@Body() dto: QueryPageDTO, @Request() req): Promise<CommonResponse> {
    return await this.appService.listFavoritesTokens(dto, req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/incTokenViews')
  async incTokenViews(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incTokenViews(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/incBlindBoxViews')
  async incBlindBoxViews(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incBlindBoxViews(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/incTokenLikes')
  async incTokenLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incTokenLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/incBlindBoxLikes')
  async incBlindBoxLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incBlindBoxLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/decTokenLikes')
  async decTokenLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.decTokenLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/decBlindBoxLikes')
  async decBlindBoxLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.decBlindBoxLikes(dto);
  }
}
