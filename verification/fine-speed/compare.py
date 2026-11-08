import numpy as np, sys
from scipy import ndimage
r=int(sys.argv[1]); nx=int(sys.argv[2]); others=sys.argv[3:]
b=np.fromfile(f'bld_r{r}.u8',np.uint8); ny=b.size//nx; b=b.reshape(ny,nx)
h=np.fromfile(f'hmax_r{r}_rc{r}.f32',np.float32).reshape(ny,nx)
open_=b==0
lab,k=ndimage.label(open_); sizes=ndimage.sum(np.ones_like(lab),lab,range(1,k+1))
cellm=30/r; pocket=np.isin(lab,np.where(sizes*cellm*cellm<=50)[0]+1)  # enclosed open patches up to 200 m2
fl=(h>0.15)&open_
print(f'{cellm} m block: open {open_.sum()}, flooded {fl.sum()} ({fl.sum()/open_.sum():.3f}), in enclosed patches <=200 m2: {(fl&pocket).sum()}')
flx=fl&~pocket
for rc in others:
  h1=np.fromfile(f'hmax_r{r}_rc{rc}.f32',np.float32).reshape(ny,nx); f1=(h1>0.15)&open_&~pocket
  m=open_&~pocket&((h>0.01)|(h1>0.01))
  print(f'  porosity {rc} : flooded share {f1.sum()/(open_&~pocket).sum():.3f} vs block {flx.sum()/(open_&~pocket).sum():.3f}; CSI {(flx&f1).sum()/((flx|f1).sum()):.3f}; depth RMSE {np.sqrt(np.mean((h[m]-h1[m])**2)):.3f} m, mean diff {np.mean(h1[m]-h[m]):+.3f} m')
