import type {Express, Request, Response} from "express";

export function registerHealthRoutes(app:Express) {
    
    app.get("/health", (req: Request, res: Response)=>{
        res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString()
        })

    })
 

}
