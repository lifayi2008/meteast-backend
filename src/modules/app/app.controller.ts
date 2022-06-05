import {
  Request,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  Body, Logger
} from "@nestjs/common";
import { AppService } from './app.service';
import { CommonResponse, UserType } from '../common/interfaces';
import { DIDBackend, VerifiablePresentation } from '@elastosfoundation/did-js-sdk';
import { MyDIDAdapter } from './did.adapter';
import { Constants } from '../common/constants';
import { User } from './interfaces';
import { LoginDTO } from './dto/LoginDTO';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ViewOrLikeDTO } from './dto/ViewOrLikeDTO';

@Controller()
export class AppController {
  private readonly logger = new Logger('AppController');

  private user: any;
  constructor(private readonly appService: AppService) {
    DIDBackend.initialize(new MyDIDAdapter());
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/listBanner')
  async listBanner(@Query('location') location: string): Promise<CommonResponse> {
    return await this.appService.listBanner(location);
  }

  @Get('/onOffSale')
  async onOffSale(
    @Query('tokenId') tokenId: string,
    @Query('operation') operation: string,
  ): Promise<CommonResponse> {
    this.logger.log(`onOffSale: ${tokenId} ${operation}`);
    return await this.appService.onOffSale(tokenId, operation);
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
  @Post('/incTokenViews')
  async incTokenViews(@Body() viewOrLikeDTO: ViewOrLikeDTO): Promise<CommonResponse> {
    return await this.appService.incTokenViews(viewOrLikeDTO);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/incTokenLikes')
  async incTokenLikes(@Body() viewOrLikeDTO: ViewOrLikeDTO): Promise<CommonResponse> {
    return await this.appService.incTokenLikes(viewOrLikeDTO);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/decTokenLikes')
  async decTokenLikes(@Body() viewOrLikeDTO: ViewOrLikeDTO): Promise<CommonResponse> {
    return await this.appService.decTokenLikes(viewOrLikeDTO);
  }
}
