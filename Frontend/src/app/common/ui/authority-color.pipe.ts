import {Pipe, PipeTransform} from "@angular/core";
import {Helper} from "../helper";
import {ColorHelper} from "./color-helper";
@Pipe({name: 'authorityColor'})
export class AuthorityColorPipe implements PipeTransform {
  public static COLORS=['#4584B3','#9B393C','#84B97C','#71B0A4','#7A79D5','#AE9957'];
  transform(authority : any,args:string[]=null): string {
    if(!authority)
      return AuthorityColorPipe.COLORS[0];
    //if(authority.profile && authority.profile.avatar)
    //  return AuthorityColorPipe.COLORS[0];
    let colors=AuthorityColorPipe.getColors();
    let id=Math.abs(AuthorityColorPipe.hash(authority.authorityName))%AuthorityColorPipe.COLORS.length;
    return AuthorityColorPipe.COLORS[id];
  }
  // https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
  private static hash(data:string) {
    let hash = 0;
    if (data.length == 0) {
      return hash;
    }
    for (let i = 0; i < data.length; i++) {
      let char = data.charCodeAt(i);
      hash = ((hash<<5)-hash)+char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
  private static getColors() {
    let colors=Helper.deepCopy(AuthorityColorPipe.COLORS);
    for(let color of AuthorityColorPipe.COLORS){
      let c=ColorHelper.cssColorToRgb(color);
      c[0]*=0.75;
      c[1]*=0.75;
      c[2]*=0.75;
      colors.push(ColorHelper.rgbToHex(c));
      c=ColorHelper.cssColorToRgb(color);
      c[0]*=1.5;
      c[1]*=1.5;
      c[2]*=1.5;
      colors.push(ColorHelper.rgbToHex(c));
    }
    return colors;
  }
}
