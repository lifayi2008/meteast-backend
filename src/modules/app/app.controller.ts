import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
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
import { NewBlindBoxDTO } from './dto/NewBlindBoxDTO';
import { BlindBoxQueryDTO } from './dto/BlindBoxQueryDTO';
import { SoldBlindBoxDTO } from './dto/SoldBlindBoxDTO';

@Controller()
export class AppController {
  private readonly logger = new Logger('AppController');

  private user: any;
  constructor(private readonly appService: AppService) {
    DIDBackend.initialize(new MyDIDAdapter());
  }

  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
  @Post('/updateUserProfile')
  async updateUserProfile(@Body() dto: UserProfileDTO, @Request() req): Promise<CommonResponse> {
    const address = new Web3().eth.accounts.recover(
      `Update profile with ${dto.address}`,
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

  @UseGuards(JwtAuthGuard)
  @Get('/getUserCandidateTokens')
  async getUserCandidateTokens(@Request() req): Promise<CommonResponse> {
    return await this.appService.getUserCandidateTokens(req.user.address);
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
  @HttpCode(HttpStatus.OK)
  @Post('/getFavoritesCollectible')
  async getFavoritesCollectible(@Request() req): Promise<CommonResponse> {
    return await this.appService.getFavoritesCollectible(req.user.address);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listMarketTokens')
  async listMarketTokens(@Body() dto: TokenQueryDTO): Promise<CommonResponse> {
    return await this.appService.listMarketTokens(dto);
  }

  @Get('/getMarketTokenByTokenId')
  async getMarketTokenByTokenId(@Query('tokenId') tokenId: string): Promise<CommonResponse> {
    return await this.appService.getMarketTokenByTokenId(tokenId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listAllMyTokens')
  async listAllMyTokens(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listAllMyTokens(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listOwnedTokensByAddress')
  async listOwnedTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listOwnedTokensByAddress(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listCreatedTokensByAddress')
  async listCreatedTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listCreatedTokensByAddress(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listSaleTokensByAddress')
  async listSaleTokensByAddress(@Body() dto: QueryByAddressDTO): Promise<CommonResponse> {
    return await this.appService.listSellTokensByAddress(dto, OrderState.Created);
  }

  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
  @Post('/listFavoritesTokens')
  async getFavoritesTokens(@Body() dto: QueryPageDTO, @Request() req): Promise<CommonResponse> {
    return await this.appService.listFavoritesTokens(dto, req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/incTokenViews')
  async incTokenViews(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incTokenViews(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/incTokenLikes')
  async incTokenLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incTokenLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/decTokenLikes')
  async decTokenLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.decTokenLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/incBlindBoxViews')
  async incBlindBoxViews(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incBlindBoxViews(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/incBlindBoxLikes')
  async incBlindBoxLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.incBlindBoxLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/decBlindBoxLikes')
  async decBlindBoxLikes(@Body() dto: ViewOrLikeDTO, @Request() req): Promise<CommonResponse> {
    dto.address = req.user.address;
    return await this.appService.decBlindBoxLikes(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/createBlindBox')
  async createBlindBox(@Body() dto: NewBlindBoxDTO, @Request() req): Promise<CommonResponse> {
    return await this.appService.createBlindBox(dto, req.user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/listMarketBlindBoxes')
  async listMarketBlindBoxes(@Body() dto: BlindBoxQueryDTO): Promise<CommonResponse> {
    return await this.appService.listMarketBlindBoxes(dto);
  }

  @Get('/getBlindBoxById')
  async getMarketBlindBoxByBlindBoxId(@Query('id') id: string): Promise<CommonResponse> {
    return await this.appService.getMarketBlindBoxByBlindBoxId(id);
  }

  @Get('/selectBlindBoxToken')
  async selectBlindBoxToken(
    @Query('id') id: string,
    @Query('count', ParseIntPipe) count: number,
  ): Promise<CommonResponse> {
    return await this.appService.selectBlindBoxToken(id, count);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/soldTokenFromBlindBox')
  async soldTokenFromBlindBox(@Body() dto: SoldBlindBoxDTO): Promise<CommonResponse> {
    return await this.appService.soldTokenFromBlindBox(dto);
  }
}
