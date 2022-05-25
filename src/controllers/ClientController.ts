//ISTO É UM API!!!
import 'dotenv/config';
import {NextFunction, Request, Response} from 'express'
import Client from '../schemas/Client';
import Operation from '../schemas/Operation'
import Controller from "./Controller";
import mongoose, {isObjectIdOrHexString, Types} from 'mongoose';
import { cpf } from 'cpf-cnpj-validator'; 
import emailvalidator from 'email-validator';
import Bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
//var passwordValidator = require('password-validator');

class ClientController extends Controller { //é preciso implementar os metodos da classe controller
  constructor() {
    super('/client'); //não consigo chegar a rota se ela não for iniciada
  }
  protected initRoutes(): void {
    //passe o caminho e o metodo para a rota
    //os verbos após router são os verbos do postman. Não pode ter a mesma rota para o mesmo verbo. 
    this.router.get(this.path, this.list); //quero receber todos
    this.router.post(`${this.path}/register`, this.create);
   // this.router.get(`${this.path}/:id`, this.findById); //quero receber apenas um // Busca pelo ID
    this.router.put(`${this.path}/:id`, this.edit); //Edição pelo ID
    this.router.delete(`${this.path}/:id`, this.delete); // Exclusão pelo ID
    this.router.patch(`${this.path}/transferencia`, this.transfer);
    this.router.patch(`${this.path}/saque`, this.saque);
    this.router.patch(`${this.path}/deposito`, this.deposito);
    this.router.get(`${this.path}/login`, this.login)

  }
  private async login(req: Request, res: Response, next: NextFunction): Promise<Response> {
    const cliente = await Client.findOne({cpf: req.body.cpf}); //.select('+password');
    if(!cliente){
      return res.status(400).send({error:'User not found'});
    /* }if(!await Bcrypt.compareSync(req.body.senha, cliente.senha)){
      return res.status(400).send({error:'Invalid password'});
    */}
    const token = jwt.sign({cpf: req.body.cpf}, process.env.SECRET, {
      expiresIn: 86400, //24h
    });
    return res.send({cliente, token});
  } 

  private async saque(req: Request, res: Response, next: NextFunction): Promise<Response> { 
    const {cpf, valsaque} = req.body
    try {
      await Client.findOneAndUpdate({cpf: [cpf]}, { $inc: { valor: -valsaque } });
      return res.send("Operação concluida");
    } catch (error) {
      return res.status(400).send(error);
    }
    
  }

  private async deposito(req: Request, res: Response, next: NextFunction): Promise<Response> { 
  const {cpf, valdepo} = req.body
  try {
    await Client.findOneAndUpdate({cpf: [cpf]}, { $inc: { valor: +valdepo } });
    return res.send("Operação concluida");
  } catch (error) {
    return res.status(400).send(error);
  }
}

  private async transfer(req: Request, res: Response, next: NextFunction): Promise<Response> {
    const { remetente, destinatario, valtransferencia } = req.body;
    const envia = await Client.findOne({cpf: remetente});
    const recebe = await Client.findOne({cpf: destinatario});
    
    try {
      if (!envia) {
        return res.status(422).json({ error: "ID do remetente é obrigatório e tem que ser válido." });
      } if (!recebe) {
        return res.status(422).json({ error: "ID do destinatário é obrigatório e tem que ser válido." });
      } if (valtransferencia <= 0 || isNaN(valtransferencia) || valtransferencia > envia.valor) {
        return res.status(422).json({ error: "Valor da transferência é obrigatório e tem que ser válido." });
      } if (envia.cpf == recebe.cpf) {
        return res.status(422).json({ error: "A conta remetente e a conta destinatário não podem ser as mesmas." });
      }

      const operacao = await Operation.create({
        remetente: remetente,
        destinatario: destinatario,
        operacao: "transferência",
        valor: valtransferencia,
      })

      operacao

      const idOpe = operacao._id;
      const Date = operacao.creation;


      // atualizar o saldo do remetente
  
      await Client.updateOne({ cpf: remetente }, { $inc: { valor: -valtransferencia } });

      await Client.updateOne({cpf: remetente},{ $push:
        { extrato: {
        idOperacao: idOpe,
        remetente: remetente,
        destinatario: destinatario,
        operacao: "transferência",
        tipo: "saida",
        valor: valtransferencia,
        createdAt: Date
      }}})

      

      // atualizar o saldo do destinatário
      await Client.updateOne({ cpf: destinatario }, { $inc: { valor: +valtransferencia } });

      //fazer push no array de objetos

      await Client.updateOne({cpf: destinatario},{ $push:
        { extrato: {
        idOperacao: idOpe,
        remetente: remetente,
        destinatario: destinatario,
        operacao: "transferência",
        tipo: "entrada",
        valor: valtransferencia,
        createdAt: Date
      }}}) //explicito é melhor que implícito
          
      //operação concluida
      
      return res.send("Operação concluida");

    } catch (error) {
      return res.status(400).send(error);
    }
  }

  private async list (req: Request, res: Response, next: NextFunction): Promise<Response> { //É uma promessa de resposta
    const client = await Client.find(); //Aguarde a resulução da busca
    return res.send(client); //fazendo a busca de todos os produtos (questão de coerencia)
  }

  private async create(req: Request, res: Response, next: NextFunction): Promise<Response> {
    // checar se o usuário já existe no sistema:
    const usuarioExiste = await Client.findOne({cpf: req.body.cpf})
    if(usuarioExiste){
      res.status(400).send('Usuário já cadastrado');
    }else{
      if(emailvalidator.validate(req.body.email)){
        // Your call to model here      //estou devolvendo a criação
        }else{
          res.status(400).send('Invalid Email');
        }
        if(cpf.isValid(req.body.cpf)){
        } else {
          res.status(400).send('Invalid cpf');
        }
        if(req.body.senha !== req.body.confirmesenha) {
          return res.status(422).json({msg: 'As senhas não são iguais'})
        }
        const client = await Client.create(req.body); //mandei criar o produto
        await Client.updateOne({ cpf: req.body.cpf }, {
          senha: Bcrypt.hashSync(req.body.senha, 10)
        });

    }
    
    return res.send('Operação concluida');

}

  /* private async findById(req: Request, res: Response, next: NextFunction): Promise<Response> {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).send('Id Inválido');
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).send('Produto não encontrado');
    }

    return res.send(client);
  } */
  private async edit(req: Request, res: Response, next: NextFunction): Promise<Response> {
    const { id } = req.params;
    await Client.findByIdAndUpdate(id, req.body);
    const client = await Client.findById(id);
    return res.send(client);
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<Response> {
    const { id } = req.params;
    const client = await Client.findById(id);
    client.deleteOne();
    return res.send(client);
  }
}


export default ClientController;
