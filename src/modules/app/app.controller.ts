import {
  Request,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  Body,
  Logger,
} from '@nestjs/common';
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

  @Get('/listBanner')
  async listBanner(@Query('location') location: string): Promise<CommonResponse> {
    return await this.appService.listBanner(location);
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
