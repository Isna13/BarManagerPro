import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'sales',
})
export class SalesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected to sales: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from sales: ${client.id}`);
  }

  @SubscribeMessage('joinBranch')
  handleJoinBranch(client: Socket, branchId: string) {
    client.join(`branch-${branchId}`);
  }

  // Eventos de atualização em tempo real
  notifyNewSale(branchId: string, sale: any) {
    this.server.to(`branch-${branchId}`).emit('newSale', sale);
  }

  notifySaleUpdated(branchId: string, sale: any) {
    this.server.to(`branch-${branchId}`).emit('saleUpdated', sale);
  }

  notifyKitchenOrder(branchId: string, order: any) {
    this.server.to(`branch-${branchId}`).emit('kitchenOrder', order);
  }
}
